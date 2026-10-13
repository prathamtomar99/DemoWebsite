import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { concurrency, summary } from './metrics.mjs'
const source = readFileSync(new URL('./independent-loader.ts', import.meta.url), 'utf8').replace(/^export \{ desktopLoader, mobileLoader \}.*$/m, '')
const { FrameLoader } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`)
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
const manifest = { frameCount: 20, width: 10, height: 10 }
const options = { maxFrames: 20, maxBytes: 8000, concurrency: 2, timeoutMs: 12000 }
function fixture(downloads = 6, settings = {}) {
  const original = globalThis.createImageBitmap, originalEvent = globalThis.__frameBenchEvent
  const fetches = [], decodes = [], changes = [], events = []; let closed = 0
  globalThis.__frameBenchEvent = e => events.push(e)
  globalThis.createImageBitmap = blob => new Promise((resolve, reject) => decodes.push({ blob, reject, finish: (width = 10) => resolve({ width, height: 10, close: () => closed++ }) }))
  const transport = { read(index, signal) { return new Promise((resolve, reject) => {
    fetches.push({ index, finish: () => resolve(new Blob([String(index)])), reject })
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  }) } }
  const loader = new FrameLoader(manifest, { ...options, ...settings }, transport, (i, f) => changes.push([i, f]), { downloads, bufferSlots: 8, maxFrameBytes: 128 * 1024 })
  return { loader, fetches, decodes, changes, events, closed: () => closed, restore() { loader.dispose(); globalThis.createImageBitmap = original; globalThis.__frameBenchEvent = originalEvent } }
}

test('fetch slots refill while decodes are blocked; eight reserved buffer slots apply backpressure', async () => {
  const f = fixture()
  try {
    f.loader.prepareAll(); assert.equal(f.fetches.length, 6)
    for (const r of [...f.fetches]) r.finish()
    await flush(); assert.equal(f.decodes.length, 2); assert.equal(f.fetches.length, 10)
    for (const r of f.fetches.slice(6)) r.finish()
    await flush(); assert.equal(f.fetches.length, 10, 'Backpressure failed'); assert.equal(f.decodes.length, 2)
    f.decodes[0].finish(); await flush()
    assert.equal(f.decodes.length, 3); assert.equal(f.fetches.length, 11)
  } finally { f.restore(); for (const d of f.decodes) d.finish(); await flush() }
})
test('cancelled native decodes retain their slots and close late results after disposal', async () => {
  const f = fixture(4)
  try {
    f.loader.prepareAll(); for (const r of [...f.fetches]) r.finish(); await flush()
    assert.equal(f.decodes.length, 2)
    f.loader.suspend(); f.loader.prepareAll(); await flush()
    for (const r of f.fetches.slice(4)) r.finish(); await flush()
    assert.equal(f.decodes.length, 2, 'Cancelled decodes freed slots too early')
    f.loader.dispose(); f.decodes.forEach(d => d.finish()); await flush()
    assert.equal(f.closed(), 2); assert.equal(f.loader.stats.cached, 0)
  } finally { f.restore() }
})
test('a transient fetch failure retries once and exhausted failures are reported', async () => {
  const f = fixture(2)
  try {
    f.loader.prepareAll(); f.fetches[0].reject(new Error('network'))
    await flush(); await new Promise(r => setTimeout(r, 110))
    const retries = f.fetches.filter(r => r.index === 0); assert.equal(retries.length, 2)
    retries[1].reject(new Error('network')); await flush()
    assert.ok(f.changes.some(([i, failed]) => i === 0 && failed)); assert.equal(f.loader.isUnavailable(0), true)
    await new Promise(r => setTimeout(r, 110)); assert.equal(f.fetches.filter(r => r.index === 0).length, 2)
  } finally { f.restore(); await flush() }
})
test('wrong dimensions close the bitmap and count a genuine failure', async () => {
  const f = fixture(2)
  try {
    f.loader.prepareAll(); f.fetches[0].finish(); await flush(); f.decodes[0].finish(11); await flush()
    assert.equal(f.closed(), 1); assert.equal(f.loader.stats.cached, 0)
    assert.equal(f.events.filter(e => e.type === 'attempt-failed').length, 1)
  } finally { f.restore(); await flush() }
})
test('memory ceiling rejects before transport admission', () => {
  const f = fixture(2, { maxBytes: 400 })
  try { assert.throws(() => f.loader.prepareAll(), /memory ceiling/); assert.equal(f.fetches.length, 0) }
  finally { f.restore() }
})
test('concurrency averages integrate intervals rather than counting queued promises', () => {
  const result = concurrency([{ start: 0, end: 10 }, { start: 5, end: 15 }], [{ start: 10, end: 20 }], 0, 20)
  assert.equal(result.peakDownloads, 2); assert.equal(result.averageDownloads, 1)
  assert.equal(result.peakDecodes, 1); assert.equal(result.averageDecodes, .5); assert.equal(result.overlapMs, 5)
  assert.equal(summary([5, 1, 3, 4, 2]).p95, 5)
})
