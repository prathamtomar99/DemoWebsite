export const sum = values => values.reduce((a, b) => a + b, 0)
export function summary(values) {
  const a = values.filter(Number.isFinite).sort((a, b) => a - b), n = a.length
  if (!n) return { n: 0, median: null, p95: null, min: null, max: null, sd: null }
  const mean = sum(a) / n
  return { n, median: n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2,
    p95: a[Math.ceil(n * .95) - 1], min: a[0], max: a[n - 1], mean,
    sd: Math.sqrt(sum(a.map(v => (v - mean) ** 2)) / n) }
}
export function concurrency(downloads, decodes, start, end) {
  const events = [[start, 0, 0], [end, 0, 0]]
  for (const [kind, records] of [[1, downloads], [2, decodes]]) for (const r of records) {
    events.push([Math.max(start, r.start), kind, 1], [Math.min(end, r.end ?? end), kind, -1])
  }
  events.sort((a, b) => a[0] - b[0] || a[2] - b[2])
  let d = 0, c = 0, peakD = 0, peakC = 0, areaD = 0, areaC = 0, overlap = 0, last = start
  for (const [time, kind, delta] of events) {
    if (time < start || time > end) continue
    const dt = time - last
    areaD += d * dt; areaC += c * dt
    if (d > 0 && c > 0) overlap += dt
    if (kind === 1) d += delta
    if (kind === 2) c += delta
    peakD = Math.max(peakD, d); peakC = Math.max(peakC, c); last = time
  }
  return { peakDownloads: peakD, peakDecodes: peakC, averageDownloads: areaD / (end - start), averageDecodes: areaC / (end - start), overlapMs: overlap, windowMs: end - start }
}
export function measure(raw, network) {
  const downloads = raw.downloads, decodes = raw.decodes, okD = downloads.filter(r => !r.error && r.end), okC = decodes.filter(r => !r.error && r.end)
  const first = Math.min(...downloads.map(r => r.start)), end = raw.canvas ?? raw.reveal ?? raw.observedAt
  const frames = raw.resources.filter(r => /\/frame_\d+\.webp/.test(r.name))
  const manifest = raw.resources.find(r => r.name.includes('/frames/') && r.name.includes('manifest.json'))
  const firstAttempts = [...new Map([...downloads].reverse().map(r => [r.index, r])).values()]
  const n = Number(raw.canvasState.frameCount || 0), retained = new Set(raw.retained.map(r => r.index)).size
  return {
    success: raw.hero.static === 'false' && raw.hero.preparing === 'false' && raw.canvasState.ready === 'true' && raw.liveCount === n && +raw.hero.cacheSize === n && n > 0,
    failure: raw.hero.preparationFailure ?? null,
    manifestMs: manifest?.duration ?? null, preparationStartMs: raw.started,
    firstDownloadMs: okD.length ? Math.min(...okD.map(r => r.end)) : null,
    allDownloadedMs: new Set(okD.map(r => r.index)).size === n && n ? Math.max(...okD.map(r => r.end)) : null,
    allDecodedMs: new Set(okC.map(r => r.index)).size === n && n ? Math.max(...okC.map(r => r.end)) : null,
    allRetainedMs: retained === n && n ? Math.max(...raw.retained.map(r => r.time)) : null,
    canvasMs: raw.canvas, revealMs: raw.reveal, removedMs: raw.removed,
    preparationMs: Number(raw.hero.preparationMs) || null,
    decodeLatencyMs: summary(okC.map(r => r.end - r.start)),
    aggregateDecodeLatencyMs: sum(okC.map(r => r.end - r.start)),
    decodeQueueWaitMs: summary(decodes.filter(r => r.downloadEnd !== undefined).map(r => r.start - r.downloadEnd)),
    downloadQueueWaitMs: summary(firstAttempts.map(r => r.start - (raw.queued ?? first))),
    concurrency: downloads.length ? concurrency(downloads, decodes, first, end) : null,
    networkConcurrency: frames.some(r => r.transferSize > 0) ? concurrency(frames.filter(r => r.transferSize > 0).map(r => ({ start: r.requestStart, end: r.responseEnd })), [], first, end) : null,
    compressedBufferPeakBytes: Math.max(0, ...raw.buffer.map(r => r.bytes)),
    compressedBufferPeakFrames: Math.max(0, ...raw.buffer.map(r => r.count)),
    compressedIncludingDecodePeakBytes: Math.max(0, ...raw.buffer.map(r => r.withDecodeBytes)),
    peakBitmapBytes: raw.peakBytes, retainedBitmapBytes: raw.liveBytes, retainedBitmapCount: raw.liveCount,
    retries: downloads.length - new Set(downloads.map(r => r.index)).size,
    failedAttempts: raw.events.filter(r => r.type === 'attempt-failed').length,
    fetchFailures: downloads.filter(r => r.error).length,
    frameCalls: downloads.length, decodeCalls: decodes.length,
    frameResourceBytes: sum(frames.map(r => r.encodedBodySize)),
    frameTransferredBytes: sum(frames.map(r => r.transferSize)),
    frameCacheHits: frames.filter(r => r.transferSize === 0 && r.encodedBodySize > 0).length,
    frameCacheMisses: frames.filter(r => r.transferSize > 0).length,
    longTasks: summary(raw.longTasks.filter(r => r.start < (raw.reveal ?? Infinity)).map(r => r.duration)),
    rafGapsMs: summary(raw.rafGaps.filter(r => r.time < (raw.reveal ?? Infinity)).map(r => r.duration)),
    heap: raw.heap, network,
  }
}
