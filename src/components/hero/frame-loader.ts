import type { FrameTransport } from './frame-transport'
import type { FrameManifest } from './manifest'
import { fullFrameLoading } from './full-frame-policy'

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

async function decodeFrame(blob: Blob, signal: AbortSignal): Promise<DecodedFrame> {
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

interface FrameJob {
  index: number
  phase: 'fetch' | 'buffer' | 'decode'
  controller: AbortController
  timer: ReturnType<typeof setTimeout>
  blob?: Blob
}

/** Full preparation separates transport and decoding; windowed demand keeps combined slots.
 * Cancelled native decodes occupy their slot until settled in either mode. */
export class FrameLoader {
  private retaining = false
  private cache = new Map<number, DecodedFrame>()
  private pending = new Map<number, FrameJob>()
  private failures = new Map<number, number>()
  private priorities: number[] = []
  private wanted = -1
  private companion = -1
  private pinned = -1
  private direction = 1
  private paused = true
  private disposed = false
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  capacity: number
  private transport: FrameTransport
  private manifest: FrameManifest
  private options: LoaderOptions
  private changed: (index: number, failed: boolean) => void

  constructor(manifest: FrameManifest, options: LoaderOptions, transport: FrameTransport, changed: (index: number, failed: boolean) => void) {
    this.transport = transport
    this.manifest = manifest
    this.options = options
    this.changed = changed
    this.capacity = Math.max(2, Math.min(options.maxFrames, Math.floor(options.maxBytes / (manifest.width * manifest.height * 4))))
  }

  prepareAll() {
    if (this.disposed) return
    if (this.capacity < this.manifest.frameCount) throw new Error('Decoded sequence exceeds memory ceiling')
    this.retaining = true
    if (this.wanted < 0) this.wanted = 0
    this.paused = false
    this.priorities = Array.from({ length: this.manifest.frameCount }, (_, index) => index)
    this.pump()
  }

  configure(options: LoaderOptions) {
    if (this.retaining || options === this.options) return
    this.options = options
    this.capacity = Math.max(2, Math.min(options.maxFrames, Math.floor(options.maxBytes / (this.manifest.width * this.manifest.height * 4))))
    this.paused = true
    this.evict()
  }

  get stats() {
    return { cached: this.cache.size, pending: this.pending.size, capacity: this.capacity }
  }

  isUnavailable(index: number) {
    return (this.failures.get(index) ?? 0) >= 2
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

  want(index: number, direction: number, companion = -1) {
    if (this.disposed) return
    if (this.retaining) {
      this.wanted = index
      if (this.paused) this.prepareAll()
      return
    }
    if (this.wanted === index && this.direction === direction && this.companion === companion && !this.paused) return
    if (index !== this.wanted) this.clearRetry()
    this.transport.prioritize(index, direction)
    this.wanted = index
    this.companion = companion
    this.direction = direction
    this.paused = false
    const priorities = [index]
    if (companion >= 0 && Math.abs(companion - index) === 1) priorities.push(companion)
    // Prioritize travel direction. Previously visited frames remain reusable in cache;
    // do not spend constrained bandwidth backfilling frames behind the target.
    for (let step = 1; step <= Math.max(this.options.ahead, this.options.behind); step++) {
      if (step <= this.options.ahead) priorities.push(index + step * direction)
      if (step <= this.options.behind) priorities.push(index - step * direction)
    }
    this.priorities = [...new Set(priorities)].filter((i) => i >= 0 && i < this.manifest.frameCount)
      .slice(0, Math.min(this.capacity - 1, 1 + this.options.ahead + this.options.behind))
    for (const [i, job] of this.pending) {
      if (!this.priorities.includes(i)) job.controller.abort('superseded')
    }
    this.pump()
  }

  suspend() {
    this.clearRetry()
    this.paused = true
    this.priorities = []
    for (const job of [...this.pending.values()]) job.controller.abort('suspended')
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
    let decoding = 0
    for (const job of this.pending.values()) if (job.phase === 'decode') decoding++
    for (const job of this.pending.values()) {
      if (decoding >= (this.retaining ? fullFrameLoading.decodes : this.options.concurrency)) break
      if (job.phase === 'buffer') { decoding++; this.decode(job) }
    }
    let fetching = 0, reserved = 0
    for (const job of this.pending.values()) {
      if (job.phase === 'fetch') fetching++
      if (job.phase !== 'decode') reserved++
    }
    for (const index of this.priorities) {
      if (this.retaining) {
        if (fetching >= fullFrameLoading.downloads || reserved >= fullFrameLoading.compressedSlots) break
      } else if (this.pending.size >= this.options.concurrency) break
      if (this.cache.has(index) || this.pending.has(index) || this.isUnavailable(index)) continue
      fetching++; reserved++
      this.load(index)
    }
  }

  private load(index: number) {
    const controller = new AbortController()
    const job: FrameJob = { index, controller, phase: 'fetch',
      timer: setTimeout(() => controller.abort('timeout'), this.options.timeoutMs) }
    this.pending.set(index, job)
    controller.signal.addEventListener('abort', () => {
      // Buffered jobs have no running promise to settle them. Native decodes do.
      if (job.phase === 'buffer') this.settle(job, new DOMException('Aborted', 'AbortError'))
    }, { once: true })
    void this.transport.read(index, controller.signal, index === this.wanted).then(blob => {
      if (controller.signal.aborted || this.disposed) throw new DOMException('Aborted', 'AbortError')
      if (this.retaining && blob.size > fullFrameLoading.maxFrameBytes) throw new Error('Compressed frame exceeds byte budget')
      job.blob = blob
      job.phase = 'buffer'
      this.pump()
    }).catch(error => this.settle(job, error))
  }

  private decode(job: FrameJob) {
    job.phase = 'decode'
    const { index, controller } = job
    void decodeFrame(job.blob!, controller.signal).then(frame => {
      if (this.disposed || controller.signal.aborted || !this.priorities.includes(index)) {
        frame.close()
        if (controller.signal.reason === 'timeout') throw new DOMException('Aborted', 'AbortError')
        return
      }
      if (frame.width !== this.manifest.width || frame.height !== this.manifest.height) {
        frame.close()
        throw new Error('Frame dimensions differ from manifest')
      }
      this.cache.set(index, frame)
      this.evict()
      this.changed(index, false)
    }).then(() => this.settle(job), error => this.settle(job, error))
  }

  private settle(job: FrameJob, error?: unknown) {
    if (this.pending.get(job.index) !== job) return
    clearTimeout(job.timer)
    job.blob = undefined
    this.pending.delete(job.index)
    const { index, controller } = job
    if (error && !this.disposed && (!controller.signal.aborted || controller.signal.reason === 'timeout')) {
      const attempts = (this.failures.get(index) ?? 0) + 1
      this.failures.set(index, attempts)
      this.deferRetry()
      if (attempts >= 2) this.changed(index, true)
    }
    this.pump()
    if (!this.disposed) this.changed(-1, false)
  }
}
