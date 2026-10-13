/** Runs only through Playwright addInitScript. No production bundle dependency. */
export function installProbe() {
  performance.setResourceTimingBufferSize(2000)
  const m = window.__frameBench = { events: [], downloads: [], decodes: [], retained: [], longTasks: [], rafGaps: [], buffer: [], liveBytes: 0, peakBytes: 0, liveCount: 0, peakCount: 0, canvas: null, reveal: null, removed: null }
  window.__frameBenchEvent = event => {
    if (event.type === 'downloaded') {
      const record = m.downloads.findLast(r => r.index === event.index)
      if (record) {
        record.end = performance.now(); record.bytes = event.blob.size
        blobs.set(event.blob, record); waiting.set(record, record.bytes); buffer()
      }
      return
    }
    const value = { ...event, time: performance.now() }
    m.events.push(value)
    if (event.type === 'queued') m.queued ??= value.time
    if (event.type === 'preparation-start') m.started ??= value.time
    if (event.type === 'retained') m.retained.push(value)
  }
  const blobs = new WeakMap(), waiting = new Map(), decodingBlobs = new Map()
  const buffer = () => m.buffer.push({ time: performance.now(), count: waiting.size, bytes: [...waiting.values()].reduce((s, n) => s + n, 0), withDecodeBytes: [...waiting.values(), ...decodingBlobs.values()].reduce((s, n) => s + n, 0) })
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (...args) => {
    const url = String(args[0]), match = url.match(/\/frame_(\d+)\.webp/)
    if (!match) return originalFetch(...args)
    const record = { index: Number(match[1]) - 1, start: performance.now(), url }
    m.downloads.push(record)
    try {
      const response = await originalFetch(...args)
      record.status = response.status
      if (!response.ok) { record.end = performance.now(); record.error = `HTTP ${response.status}`; return response }
      if (response.body) {
        const getReader = response.body.getReader.bind(response.body)
        response.body.getReader = (...readerArgs) => {
          const reader = getReader(...readerArgs), read = reader.read.bind(reader)
          reader.read = async (...readArgs) => {
            try {
              const result = await read(...readArgs)
              if (result.done) record.end = performance.now()
              return result
            } catch (error) { record.end = performance.now(); record.error = String(error); throw error }
          }
          return reader
        }
      }
      const originalBlob = response.blob.bind(response)
      response.blob = async () => {
        try {
          const blob = await originalBlob()
          record.end = performance.now(); record.bytes = blob.size
          blobs.set(blob, record); waiting.set(record, blob.size); buffer()
          return blob
        } catch (error) { record.end = performance.now(); record.error = String(error); throw error }
      }
      return response
    } catch (error) { record.end = performance.now(); record.error = String(error); throw error }
  }
  const originalDecode = window.createImageBitmap.bind(window)
  window.createImageBitmap = async (...args) => {
    const download = blobs.get(args[0])
    const record = { index: download?.index, start: performance.now(), downloadEnd: download?.end }
    m.decodes.push(record)
    if (download) { waiting.delete(download); decodingBlobs.set(record, download.bytes); buffer() }
    try {
      const bitmap = await originalDecode(...args)
      record.end = performance.now()
      const bytes = bitmap.width * bitmap.height * 4
      m.liveBytes += bytes; m.liveCount++
      m.peakBytes = Math.max(m.peakBytes, m.liveBytes); m.peakCount = Math.max(m.peakCount, m.liveCount)
      const close = bitmap.close.bind(bitmap); let closed = false
      bitmap.close = () => { if (!closed) { closed = true; m.liveBytes -= bytes; m.liveCount--; m.lastCloseMs = performance.now() } close() }
      return bitmap
    } catch (error) { record.end = performance.now(); record.error = String(error); throw error }
    finally { decodingBlobs.delete(record); buffer() }
  }
  new PerformanceObserver(list => m.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true })
  new MutationObserver(() => {
    const hero = document.querySelector('#home'), canvas = document.querySelector('canvas')
    if (canvas?.dataset.ready === 'true') m.canvas ??= performance.now()
    if (hero?.dataset.preparing === 'false') {
      m.reveal ??= performance.now()
      if (!document.querySelector('.hero-preparation')) m.removed ??= performance.now()
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-ready', 'data-preparing'] })
  let previous = performance.now()
  const tick = time => { m.rafGaps.push({ time, duration: time - previous }); previous = time; if (m.reveal === null) requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
}

export function snapshot() {
  return { ...window.__frameBench, observedAt: performance.now(), hero: { ...document.querySelector('#home')?.dataset }, canvasState: { ...document.querySelector('canvas')?.dataset }, resources: performance.getEntriesByType('resource').map(e => e.toJSON()), navigation: performance.getEntriesByType('navigation')[0]?.toJSON(), heap: performance.memory ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize } : null }
}

export async function checkScrolling() {
  const m = window.__frameBench, startRequests = m.downloads.length, startDecodes = m.decodes.length
  const hero = document.querySelector('#home'), canvas = document.querySelector('canvas'), viewport = document.querySelector('.hero-viewport')
  const count = Number(canvas.dataset.frameCount), samples = [], errors = []
  const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const seek = p => scrollTo(0, hero.offsetTop + (hero.offsetHeight - viewport.offsetHeight) * p)
  const traversal = { gaps: [], blankSamples: 0, pairMissSamples: 0, start: performance.now() }
  for (const [from, to, duration] of [[0, 1, 1000], [1, 0, 600]]) {
    const start = performance.now(); let previous = start
    await new Promise(resolve => {
      const tick = time => {
        traversal.gaps.push(time - previous); previous = time
        if (canvas.dataset.ready !== 'true') traversal.blankSamples++
        if (canvas.dataset.blendAvailable !== 'true') traversal.pairMissSamples++
        const t = Math.min(1, (time - start) / duration)
        seek(from + (to - from) * t)
        if (t < 1) requestAnimationFrame(tick); else resolve()
      }
      requestAnimationFrame(tick)
    })
  }
  traversal.end = performance.now()
  traversal.longTasks = m.longTasks.filter(t => t.start >= traversal.start && t.start <= traversal.end)
  if (traversal.blankSamples || traversal.pairMissSamples) errors.push({ kind: 'continuous-traversal', traversal })
  const read = () => {
    const p = Math.max(0, Math.min(1, -hero.getBoundingClientRect().top / (hero.offsetHeight - viewport.offsetHeight)))
    const position = p * (count - 1), fraction = position - Math.floor(position)
    const t = Math.max(0, Math.min(1, (fraction - .35) / .30)), alpha = t * t * (3 - 2 * t)
    const expected = Math.round(position) + 1, state = { ...canvas.dataset }
    if (+state.paintedFrame !== expected || state.ready !== 'true' || state.blendAvailable !== 'true') errors.push({ kind: 'mapping', p, expected, state })
    if (alpha > 0 && alpha < 1 && (+state.blendNext !== +state.blendBase + 1 || Math.abs(+state.blendAlpha - alpha) > .002)) errors.push({ kind: 'blend', p, alpha, state })
    const stage = p <= .04 ? 'intro' : p >= .24 && p <= .43 ? 'right' : p >= .61 && p <= .8 ? 'left' : p >= .96 ? 'finale' : null
    if (stage) {
      const panel = document.querySelector(`[data-story="${stage}"]`)
      if (Number(getComputedStyle(panel).opacity) < .99 || panel.dataset.active !== 'true') errors.push({ kind: 'story', stage, p })
    }
    // Read pixels only after startup metrics; readiness alone would not detect an empty backing store.
    const ctx = canvas.getContext('2d'), data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let variation = false
    for (let i = 400; i < data.length; i += 400) if (Math.abs(data[i] - data[0]) + Math.abs(data[i + 1] - data[1]) + Math.abs(data[i + 2] - data[2]) > 30) { variation = true; break }
    if (!variation) errors.push({ kind: 'blank', p })
    samples.push({ p, expected, painted: +state.paintedFrame, alpha: +state.blendAlpha, stage })
  }
  for (const p of [0, .3, .7, 1, .7, .3, 0, (Math.floor(count * .45) + .5) / (count - 1)]) { seek(p); await settle(); read() }
  // Multiple contradictory seeks in one turn must resolve to the final position.
  for (const p of [.9, .1, .8, .2, .97]) seek(p)
  await settle(); read()
  if (m.downloads.length !== startRequests || m.decodes.length !== startDecodes) errors.push({ kind: 'extra-work' })
  const before = canvas.dataset.renderCount
  await new Promise(resolve => setTimeout(resolve, 100))
  if (canvas.dataset.renderCount !== before) errors.push({ kind: 'idle-repaint' })
  seek(0); await settle()
  return { pass: errors.length === 0, errors, samples, traversal, extraDownloads: m.downloads.length - startRequests, extraDecodes: m.decodes.length - startDecodes }
}
