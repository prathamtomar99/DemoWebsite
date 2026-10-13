import { frameUrl } from './manifest'
import type { FrameManifest } from './manifest'

type Waiter = { resolve: (blob: Blob) => void; reject: (reason: unknown) => void; signal: AbortSignal; abort: () => void }
type Job = { index: number; high?: boolean; settled?: boolean; waiters: Set<Waiter>; controller?: AbortController; timer?: ReturnType<typeof setTimeout> }
export type FrameConnection = EventTarget & { saveData?: boolean; effectiveType?: string; downlink?: number; rtt?: number }
export interface TransportOptions { concurrency: number; maxFrameBytes?: number }

/** Bound retained response chunks before constructing a Blob; never trust size headers alone. */
async function readFrameBlob(response: Response, maxBytes?: number): Promise<Blob> {
  if (maxBytes === undefined) return response.blob()
  const tooLarge = () => new Error('Compressed frame exceeds byte budget')
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel()
    throw tooLarge()
  }
  if (!response.body) throw new Error('Frame response has no readable body')
  const reader = response.body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let bytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > maxBytes) { await reader.cancel(); throw tooLarge() }
      chunks.push(value)
    }
    return new Blob(chunks, { type: response.headers.get('content-type') ?? '' })
  } finally { reader.releaseLock() }
}
export function connectionAllowsWarmup(connection?: Pick<FrameConnection, 'saveData' | 'effectiveType' | 'downlink' | 'rtt'>) {
  return !connection?.saveData && !['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '') &&
    (connection?.downlink === undefined || connection.downlink >= 2) && (connection?.rtt === undefined || connection.rtt <= 150)
}

/** Shared compressed fetch pool. Only active responses retain a Blob; HTTP cache owns reuse.
 * Configured demand slots, at most one speculative request, no speculative decoding. */
export class FrameTransport {
  private jobs = new Map<number, Job>()
  private completed = new Set<number>()
  private attempted = new Set<number>()
  private active = 0
  private warming = false
  private reusable = true
  private disposed = false
  private target = 0
  private direction = 1
  private lastTravel = 0
  private idle: ReturnType<typeof setTimeout> | undefined
  private manifest: FrameManifest
  private changed: (count: number) => void
  private options: TransportOptions
  constructor(manifest: FrameManifest, changed: (count: number) => void, options: TransportOptions = { concurrency: 2 }) {
    if (!Number.isInteger(options.concurrency) || options.concurrency < 1 ||
      (options.maxFrameBytes !== undefined && (!Number.isSafeInteger(options.maxFrameBytes) || options.maxFrameBytes <= 0))) throw new Error('Invalid transport limits')
    this.manifest = manifest
    this.changed = changed
    this.options = options
  }

  read(index: number, signal: AbortSignal, current = true): Promise<Blob> {
    if (this.disposed || signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
    // Promote an in-flight warmup rather than starting a second fetch.
    let job = this.jobs.get(index)
    if (!job || job.settled || job.controller?.signal.aborted) { job = { index, waiters: new Set() }; this.jobs.set(index, job) }
    job.high ||= current
    const selected = job
    const promise = new Promise<Blob>((resolve, reject) => {
      const waiter: Waiter = { resolve, reject, signal, abort: () => {
        selected.waiters.delete(waiter)
        reject(new DOMException('Aborted', 'AbortError'))
        if (!selected.waiters.size) selected.controller?.abort()
        if (!selected.controller) this.jobs.delete(index)
      } }
      selected.waiters.add(waiter)
      signal.addEventListener('abort', waiter.abort, { once: true })
    })
    // Visible work preempts unrelated speculation. Aborted slots remain occupied until settled.
    for (const other of this.jobs.values()) if (other !== selected && !other.waiters.size) other.controller?.abort()
    this.pump()
    return promise
  }

  prioritize(index: number, direction: number) {
    if (this.target !== index) this.lastTravel = performance.now()
    this.target = index
    this.direction = direction
  }
  warm(enabled: boolean) {
    this.warming = enabled && this.reusable
    if (!enabled) {
      clearTimeout(this.idle)
      this.idle = undefined
      for (const job of this.jobs.values()) if (!job.waiters.size) job.controller?.abort()
    }
    this.pump()
  }
  dispose() {
    this.disposed = true
    clearTimeout(this.idle)
    for (const job of this.jobs.values()) {
      job.controller?.abort()
      for (const waiter of job.waiters) { waiter.signal.removeEventListener('abort', waiter.abort); waiter.reject(new DOMException('Aborted', 'AbortError')) }
      job.waiters.clear()
    }
    this.jobs.clear()
  }
  private pump() {
    if (this.disposed) return
    for (const job of this.jobs.values()) {
      if (this.active >= this.options.concurrency) break
      if (!job.controller && job.waiters.size) this.start(job)
    }
    if (!this.warming || this.active || this.idle !== undefined || this.jobs.size) return
    // Give queued decodes and critical page resources precedence over background downloads.
    this.idle = setTimeout(() => {
      this.idle = undefined
      if (this.disposed || !this.warming || this.active || this.jobs.size) return
      if (performance.now() - this.lastTravel < 200) { this.pump(); return }
      for (let step = 0; step < this.manifest.frameCount; step++) {
        const index = (this.target + step * this.direction + this.manifest.frameCount) % this.manifest.frameCount
        if (this.completed.has(index) || this.attempted.has(index)) continue
        const job: Job = { index, waiters: new Set() }
        this.jobs.set(index, job)
        this.start(job)
        break
      }
    }, Math.max(25, 200 - (performance.now() - this.lastTravel)))
  }
  private start(job: Job) {
    this.active++
    const controller = job.controller = new AbortController()
    job.timer = setTimeout(() => controller.abort('timeout'), 12000)
    const url = frameUrl(this.manifest, job.index)
    const started = performance.now()
    void fetch(url, { signal: controller.signal, cache: 'force-cache', priority: job.high ? 'high' : 'low' })
      .then(async response => {
        if (!response.ok) {
          await response.body?.cancel()
          throw new Error(`Image request failed: ${response.status}`)
        }
        const blob = await readFrameBlob(response, this.options.maxFrameBytes)
        if (controller.signal.aborted || this.disposed) throw new DOMException('Aborted', 'AbortError')
        // Some engines revalidate/refetch despite force-cache. Stop further speculation
        // on observed repeat transfer; ordinary demand loading remains fully functional.
        if (this.completed.has(job.index) && job.waiters.size && typeof location !== 'undefined') {
          const entries = performance.getEntriesByName(new URL(url, location.href).href)
          const timing = entries.at(-1) as PerformanceResourceTiming | undefined
          if (timing && timing.startTime >= started - 1 && timing.transferSize > 0) {
            this.reusable = false
            this.warm(false)
          }
        }
        job.settled = true
        this.completed.add(job.index)
        this.changed(this.completed.size)
        for (const waiter of job.waiters) waiter.resolve(blob)
        // No Blob or Response retained in completed/attempted bookkeeping.
      }).catch(error => {
        job.settled = true
        if (!controller.signal.aborted || controller.signal.reason === 'timeout') this.attempted.add(job.index)
        for (const waiter of job.waiters) waiter.reject(error)
      }).finally(() => {
        clearTimeout(job.timer)
        for (const waiter of job.waiters) waiter.signal.removeEventListener('abort', waiter.abort)
        if (this.jobs.get(job.index) === job) this.jobs.delete(job.index)
        this.active--
        this.pump()
      })
  }
}
