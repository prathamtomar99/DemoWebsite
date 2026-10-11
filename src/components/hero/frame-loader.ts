import { frameUrl } from './manifest'
import type { FrameManifest } from './manifest'

export interface DecodedFrame {
  image: CanvasImageSource
  width: number
  height: number
  close: () => void
}

export interface LoaderOptions {
  maxFrames: number
  maxBytes: number
  concurrency: number
  ahead: number
  behind: number
  timeoutMs: number
}

export const desktopLoader: LoaderOptions = {
  maxFrames: 12, maxBytes: 64 * 1024 ** 2, concurrency: 2, ahead: 2, behind: 0, timeoutMs: 12000,
}
export const mobileLoader: LoaderOptions = {
  maxFrames: 6, maxBytes: 24 * 1024 ** 2, concurrency: 2, ahead: 2, behind: 0, timeoutMs: 12000,
}

async function decodeFrame(url: string, signal: AbortSignal, current: boolean): Promise<DecodedFrame> {
  const response = await fetch(url, { signal, cache: 'force-cache', priority: current ? 'high' : 'low' })
  if (!response.ok) throw new Error(`Image request failed: ${response.status}`)
  const blob = await response.blob()
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  if (typeof createImageBitmap === 'function') {
    const image = await createImageBitmap(blob)
    if (signal.aborted) {
      image.close()
      throw new DOMException('Aborted', 'AbortError')
    }
    return { image, width: image.width, height: image.height, close: () => image.close() }
  }
  const objectUrl = URL.createObjectURL(blob)
  const image = new Image()
  const abort = () => { image.src = '' }
  signal.addEventListener('abort', abort, { once: true })
  try {
    image.src = objectUrl
    await image.decode()
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    return { image, width: image.naturalWidth, height: image.naturalHeight, close: () => { image.src = '' } }
  } finally {
    signal.removeEventListener('abort', abort)
    URL.revokeObjectURL(objectUrl)
  }
}

/** One request+decode pool. Superseded decodes occupy their slot until settled. */
export class FrameLoader {
  private cache = new Map<number, DecodedFrame>()
  private pending = new Map<number, AbortController>()
  private failures = new Map<number, number>()
  private priorities: number[] = []
  private wanted = -1
  private pinned = -1
  private direction = 1
  private paused = true
  private disposed = false
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  capacity: number
  private manifest: FrameManifest
  private options: LoaderOptions
  private changed: (index: number, failed: boolean) => void

  constructor(manifest: FrameManifest, options: LoaderOptions, changed: (index: number, failed: boolean) => void) {
    this.manifest = manifest
    this.options = options
    this.changed = changed
    this.capacity = Math.max(2, Math.min(options.maxFrames, Math.floor(options.maxBytes / (manifest.width * manifest.height * 4))))
  }

  configure(options: LoaderOptions) {
    if (options === this.options) return
    this.options = options
    this.capacity = Math.max(2, Math.min(options.maxFrames, Math.floor(options.maxBytes / (this.manifest.width * this.manifest.height * 4))))
    this.paused = true
    this.evict()
  }

  get stats() {
    return { cached: this.cache.size, pending: this.pending.size, capacity: this.capacity }
  }

  get(index: number) {
    const entry = this.cache.get(index)
    if (entry) {
      this.cache.delete(index)
      this.cache.set(index, entry)
    }
    return entry
  }

  pin(index: number) {
    this.pinned = index
    this.evict()
  }

  want(index: number, direction: number) {
    if (this.disposed) return
    if (this.wanted === index && this.direction === direction && !this.paused) return
    if (index !== this.wanted) this.clearRetry()
    this.wanted = index
    this.direction = direction
    this.paused = false
    const priorities = [index]
    // Prioritize travel direction. Previously visited frames remain reusable in cache;
    // do not spend constrained bandwidth backfilling frames behind the target.
    for (let step = 1; step <= Math.max(this.options.ahead, this.options.behind); step++) {
      if (step <= this.options.ahead) priorities.push(index + step * direction)
      if (step <= this.options.behind) priorities.push(index - step * direction)
    }
    this.priorities = priorities.filter((i) => i >= 0 && i < this.manifest.frameCount).slice(0, this.capacity - 1)
    for (const [i, controller] of this.pending) {
      if (!this.priorities.includes(i)) controller.abort('superseded')
    }
    this.pump()
  }

  suspend() {
    this.clearRetry()
    this.paused = true
    this.priorities = []
    for (const controller of this.pending.values()) controller.abort('suspended')
  }

  dispose() {
    this.disposed = true
    this.suspend()
    for (const entry of this.cache.values()) entry.close()
    this.cache.clear()
  }

  private evict() {
    for (const [index, frame] of this.cache) {
      if (this.cache.size <= this.capacity) break
      if (index === this.wanted || index === this.pinned) continue
      frame.close()
      this.cache.delete(index)
    }
  }

  private clearRetry() {
    clearTimeout(this.retryTimer)
    this.retryTimer = undefined
  }

  private deferRetry() {
    if (this.retryTimer !== undefined) return
    // Yield after genuine failures. WebKit can cancel navigation fetches before pagehide;
    // synchronous retries in that departing document trigger access-control diagnostics.
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined
      this.pump()
    }, 100)
  }

  private pump() {
    if (this.disposed || this.paused || this.retryTimer !== undefined) return
    for (const index of this.priorities) {
      if (this.pending.size >= this.options.concurrency) break
      if (this.cache.has(index) || this.pending.has(index) || (this.failures.get(index) ?? 0) >= 2) continue
      this.load(index)
    }
  }

  private load(index: number) {
    const controller = new AbortController()
    this.pending.set(index, controller)
    const timeout = setTimeout(() => controller.abort('timeout'), this.options.timeoutMs)
    void decodeFrame(frameUrl(this.manifest, index), controller.signal, index === this.wanted).then((frame) => {
      if (this.disposed || controller.signal.aborted || !this.priorities.includes(index)) {
        frame.close()
        return
      }
      if (frame.width !== this.manifest.width || frame.height !== this.manifest.height) {
        frame.close()
        throw new Error('Frame dimensions differ from manifest')
      }
      this.cache.set(index, frame)
      this.evict()
      this.changed(index, false)
    }).catch(() => {
      if (this.disposed || (controller.signal.aborted && controller.signal.reason !== 'timeout')) return
      const attempts = (this.failures.get(index) ?? 0) + 1
      this.failures.set(index, attempts)
      this.deferRetry()
      if (attempts >= 2) this.changed(index, true)
    }).finally(() => {
      clearTimeout(timeout)
      this.pending.delete(index)
      this.pump()
      if (!this.disposed) this.changed(-1, false)
    })
  }
}
