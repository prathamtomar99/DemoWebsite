/** Benchmark-only full-retention loader. Never imported by the production entry point. */
import type { FrameTransport } from '../../src/components/hero/frame-transport'
import type { FrameManifest } from '../../src/components/hero/manifest'
import type { DecodedFrame, LoaderOptions } from '../../src/components/hero/frame-loader'
export { desktopLoader, mobileLoader } from '../../src/components/hero/frame-loader'

declare const __BENCH_DOWNLOADS__: number
type Phase = 'fetch' | 'buffer' | 'decode'
interface Job {
  index: number
  phase: Phase
  controller: AbortController
  timer: ReturnType<typeof setTimeout>
  blob?: Blob
}
interface Limits { downloads: number; bufferSlots: number; maxFrameBytes: number }
function emit(type: string, index: number, extra: Record<string, number> = {}) {
  const target = globalThis as typeof globalThis & { __frameBenchEvent?: (value: object) => void }
  target.__frameBenchEvent?.({ type, index, ...extra })
}

export class FrameLoader {
  private cache = new Map<number, DecodedFrame>()
  private jobs = new Map<number, Job>()
  private failures = new Map<number, number>()
  private paused = true
  private disposed = false
  private announced = false
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  private manifest: FrameManifest
  private options: LoaderOptions
  private transport: FrameTransport
  private changed: (index: number, failed: boolean) => void
  private limits: Limits
  capacity: number

  constructor(manifest: FrameManifest, options: LoaderOptions, transport: FrameTransport,
    changed: (index: number, failed: boolean) => void,
    limits: Limits = { downloads: typeof __BENCH_DOWNLOADS__ === 'undefined' ? 2 : __BENCH_DOWNLOADS__, bufferSlots: 8, maxFrameBytes: 128 * 1024 }) {
    if (![2, 4, 6].includes(limits.downloads) || limits.bufferSlots < limits.downloads) throw new Error('Invalid benchmark limits')
    this.manifest = manifest
    this.options = options
    this.transport = transport
    this.changed = changed
    this.limits = limits
    this.capacity = Math.min(options.maxFrames, Math.floor(options.maxBytes / (manifest.width * manifest.height * 4)))
  }

  prepareAll() {
    if (this.disposed) return
    if (this.capacity < this.manifest.frameCount) throw new Error('Decoded sequence exceeds memory ceiling')
    if (!this.announced) {
      this.announced = true
      emit('queued', -1, { total: this.manifest.frameCount })
    }
    this.paused = false
    this.pump()
  }
  configure(_options: LoaderOptions) { /* Selected full-retention budget stays latched. */ }
  get stats() { return { cached: this.cache.size, pending: this.jobs.size, capacity: this.capacity } }
  get(index: number) { return this.cache.get(index) }
  pin(_index: number) { /* Every frame is retained. */ }
  isUnavailable(index: number) { return (this.failures.get(index) ?? 0) >= 2 }
  want(_index: number, _direction: number, _companion = -1) { if (this.paused) this.prepareAll() }

  suspend() {
    this.paused = true
    clearTimeout(this.retryTimer)
    this.retryTimer = undefined
    for (const job of [...this.jobs.values()]) job.controller.abort('suspended')
  }
  dispose() {
    this.disposed = true
    this.suspend()
    for (const frame of this.cache.values()) frame.close()
    this.cache.clear()
  }

  private pump() {
    if (this.disposed || this.paused || this.retryTimer !== undefined) return
    // Count real unfinished decodes, including decodes whose signal was cancelled.
    let decoding = [...this.jobs.values()].filter(job => job.phase === 'decode').length
    for (const job of this.jobs.values()) {
      if (decoding >= 2) break
      if (job.phase === 'buffer') { decoding++; this.decode(job) }
    }
    let fetching = [...this.jobs.values()].filter(job => job.phase === 'fetch').length
    let reserved = [...this.jobs.values()].filter(job => job.phase !== 'decode').length
    for (let index = 0; index < this.manifest.frameCount; index++) {
      if (fetching >= this.limits.downloads || reserved >= this.limits.bufferSlots) break
      if (this.cache.has(index) || this.jobs.has(index) || this.isUnavailable(index)) continue
      fetching++; reserved++
      this.download(index)
    }
  }

  private download(index: number) {
    const controller = new AbortController()
    const job: Job = { index, controller, phase: 'fetch', timer: setTimeout(() => controller.abort('timeout'), this.options.timeoutMs) }
    this.jobs.set(index, job)
    controller.signal.addEventListener('abort', () => {
      // Buffer entries have no running promise to settle them. Decodes keep their slot.
      if (job.phase === 'buffer') this.settle(job, new DOMException('Aborted', 'AbortError'))
    }, { once: true })
    void this.transport.read(index, controller.signal, index === 0).then(blob => {
      if (controller.signal.aborted || this.disposed) throw new DOMException('Aborted', 'AbortError')
      // Fixed assets are verified below this ceiling before any benchmark build runs.
      if (blob.size > this.limits.maxFrameBytes) throw new Error('Compressed frame exceeds benchmark reservation')
      job.blob = blob
      job.phase = 'buffer'
      this.pump() // Network admission is independent of decode completion.
    }).catch(error => this.settle(job, error))
  }

  private decode(job: Job) {
    job.phase = 'decode'
    void createImageBitmap(job.blob!).then(image => {
      if (job.controller.signal.aborted || this.disposed) {
        image.close()
        throw new DOMException('Aborted', 'AbortError')
      }
      if (image.width !== this.manifest.width || image.height !== this.manifest.height) {
        image.close()
        throw new Error('Frame dimensions differ from manifest')
      }
      this.cache.set(job.index, { image, width: image.width, height: image.height, close: () => image.close() })
      emit('retained', job.index)
      this.changed(job.index, false)
      this.settle(job)
    }).catch(error => this.settle(job, error))
  }

  private settle(job: Job, error?: unknown) {
    if (this.jobs.get(job.index) !== job) return
    clearTimeout(job.timer)
    job.blob = undefined
    this.jobs.delete(job.index)
    if (error && !this.disposed && (!job.controller.signal.aborted || job.controller.signal.reason === 'timeout')) {
      const attempts = (this.failures.get(job.index) ?? 0) + 1
      this.failures.set(job.index, attempts)
      emit('attempt-failed', job.index, { attempts })
      if (this.retryTimer === undefined) this.retryTimer = setTimeout(() => {
        this.retryTimer = undefined
        this.pump()
      }, 100)
      if (attempts >= 2) this.changed(job.index, true)
    }
    this.pump()
    if (!this.disposed) this.changed(-1, false)
  }
}
