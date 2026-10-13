import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
const source = readFileSync(new URL('../src/components/hero/frame-loader.ts', import.meta.url), 'utf8')
  .replace("from './full-frame-policy'", `from '${new URL('../src/components/hero/full-frame-policy.ts', import.meta.url).href}'`)
const { FrameLoader } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`)
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const sleep = ms => new Promise(r => setTimeout(r, ms))
function fixture(settings = {}) {
  const native = globalThis.createImageBitmap, fetches = [], decodes = [], changes = [], closed = []
  globalThis.createImageBitmap = blob => new Promise((resolve, reject) => decodes.push({ blob, reject,
    finish(width = 10) { const image = { width, height: 10, close: () => closed.push(image) }; resolve(image) } }))
  const transport = { prioritize() {}, read(index, signal) { return new Promise((resolve, reject) => {
    const job = { index, signal, finish: (bytes = String(index)) => resolve(new Blob([bytes])), reject }
    fetches.push(job)
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  }) } }
  const loader = new FrameLoader({ frameCount: settings.frameCount ?? 20, width: 10, height: 10 },
    { maxFrames: 20, maxBytes: 8000, concurrency: 2, ahead: 2, behind: 0, timeoutMs: 12000, ...settings }, transport, (i, f) => changes.push([i, f]))
  return { loader, fetches, decodes, changes, closed, async restore() { loader.dispose(); decodes.forEach(d => d.finish()); await flush(); globalThis.createImageBitmap = native } }
}
test('full preparation refills four downloads independently, handles out-of-order bodies, and applies eight-reservation backpressure', async () => {
  const f = fixture()
  try {
    f.loader.prepareAll(); f.loader.prepareAll(); assert.equal(f.fetches.length, 4)
    f.fetches[3].finish(); await flush(); assert.equal(await f.decodes[0].blob.text(), '3'); assert.equal(f.fetches.length, 5)
    f.fetches[1].finish(); await flush(); assert.equal(await f.decodes[1].blob.text(), '1'); assert.equal(f.fetches.length, 6)
    for (const r of f.fetches) r.finish()
    await flush()
    for (const r of f.fetches) r.finish()
    await flush()
    assert.equal(f.decodes.length, 2); assert.equal(f.fetches.length, 10)
    assert.equal(new Set(f.fetches.map(r => r.index)).size, 10)
    f.loader.prepareAll(); assert.equal(f.fetches.length, 10)
    f.decodes[0].finish(); await flush(); assert.equal(f.decodes.length, 3); assert.equal(f.fetches.length, 11)
    assert.equal(f.loader.get(3).width, 10)
  } finally { await f.restore() }
})
test('cancelled native decodes keep slots through resume and close late results exactly once', async () => {
  const f = fixture()
  try {
    f.loader.prepareAll(); for (const r of [...f.fetches]) r.finish(); await flush()
    f.loader.suspend(); f.loader.prepareAll(); await flush()
    for (const r of f.fetches.slice(4)) r.finish(); await flush()
    assert.equal(f.decodes.length, 2)
    f.loader.dispose(); f.decodes.forEach(d => d.finish()); await flush()
    assert.equal(f.closed.length, 2); assert.equal(new Set(f.closed).size, 2); assert.equal(f.loader.stats.cached, 0)
    f.loader.prepareAll(); assert.equal(f.loader.stats.pending, 0)
    assert.ok(!f.changes.some(([, failed]) => failed))
  } finally { await f.restore() }
})
test('download cancellation does not consume a retry and disposal stops admission', async () => {
  const f = fixture()
  try {
    f.loader.prepareAll(); f.loader.suspend(); await flush()
    assert.equal(f.loader.stats.pending, 0); assert.ok(f.fetches.every(r => r.signal.aborted))
    f.loader.prepareAll(); assert.equal(f.fetches.filter(r => r.index === 0).length, 2)
    f.loader.dispose(); await flush(); assert.equal(f.decodes.length, 0); assert.equal(f.loader.stats.cached, 0)
  } finally { await f.restore() }
})
for (const failure of ['download', 'corrupt', 'dimensions', 'oversize']) test(`${failure} failures retry once, exhaust, and release invalid bitmaps`, async () => {
  const f = fixture({ frameCount: 1 })
  try {
    f.loader.prepareAll()
    for (let attempt = 0; attempt < 2; attempt++) {
      const request = f.fetches.filter(r => r.index === 0).at(-1)
      if (failure === 'download') request.reject(new Error('network'))
      else {
        request.finish(failure === 'oversize' ? new Uint8Array(262145) : '0'); await flush()
        if (failure === 'corrupt') f.decodes.at(-1).reject(new Error('invalid WebP'))
        if (failure === 'dimensions') f.decodes.at(-1).finish(11)
      }
      await flush(); await sleep(110)
    }
    assert.equal(f.loader.isUnavailable(0), true); assert.equal(f.fetches.filter(r => r.index === 0).length, 2)
    assert.ok(f.changes.some(([i, failed]) => i === 0 && failed)); assert.equal(f.loader.stats.cached, 0)
    if (failure === 'dimensions') assert.equal(f.closed.length, 2)
  } finally { await f.restore() }
})
test('timed-out native decodes retain slots until settlement and retry genuine timeouts', async () => {
  const f = fixture({ timeoutMs: 20 })
  try {
    f.loader.prepareAll(); f.fetches[0].finish(); f.fetches[1].finish(); await flush()
    await sleep(35); assert.equal(f.decodes.length, 2); assert.ok(f.fetches[0].signal.aborted)
    f.decodes[0].finish(); f.decodes[1].finish(); await flush(); await sleep(120)
    assert.equal(f.closed.length, 2); assert.equal(f.loader.stats.cached, 0)
    assert.equal(f.fetches.filter(r => r.index === 0).length, 2)
  } finally { await f.restore() }
})
test('memory eligibility rejects before downloads and full retention ignores windowed reconfiguration', async () => {
  const low = fixture({ maxBytes: 400 })
  try { assert.throws(() => low.loader.prepareAll(), /memory ceiling/); assert.equal(low.fetches.length, 0) } finally { await low.restore() }
  const full = fixture()
  try { full.loader.prepareAll(); full.loader.configure({ maxFrames: 2, maxBytes: 800 }); assert.equal(full.loader.capacity, 20) } finally { await full.restore() }
})
test('windowed demand preserves two combined slots, supersession, pinning, eviction, and reconfiguration', async () => {
  const f = fixture({ maxFrames: 3 })
  try {
    f.loader.want(0, 1); assert.equal(f.fetches.length, 2)
    f.fetches[0].finish(); await flush(); assert.equal(f.fetches.length, 2, 'Windowed slot released before decode')
    f.decodes[0].finish(); await flush(); f.loader.pin(0)
    f.loader.want(10, 1); await flush(); assert.ok(f.fetches[1].signal.aborted)
    for (let i = 0; i < 4; i++) { for (const r of f.fetches) r.finish(); await flush(); for (const d of f.decodes) d.finish(); await flush() }
    f.loader.want(15, 1)
    for (let i = 0; i < 4; i++) { for (const r of f.fetches) r.finish(); await flush(); for (const d of f.decodes) d.finish(); await flush() }
    assert.ok(f.loader.stats.cached <= 3); assert.ok(f.loader.get(0)); assert.ok(f.closed.length > 0)
    f.loader.configure({ maxFrames: 2, maxBytes: 800, concurrency: 2, ahead: 1, behind: 0, timeoutMs: 12000 })
    assert.equal(f.loader.capacity, 2); assert.ok(f.loader.stats.cached <= 2)
  } finally { await f.restore() }
})
test('windowed HTMLImage fallback decodes, revokes its object URL and releases the image on disposal', async () => {
  const originalImage = globalThis.Image, revoke = URL.revokeObjectURL, images = [], revoked = []
  const f = fixture({ maxFrames: 3 })
  globalThis.createImageBitmap = undefined
  globalThis.Image = class { constructor() { this.naturalWidth = 10; this.naturalHeight = 10; images.push(this) } decode() { return Promise.resolve() } }
  URL.revokeObjectURL = url => { revoked.push(url); revoke(url) }
  try {
    f.loader.want(0, 1); f.fetches[0].finish(); await flush()
    assert.equal(f.loader.get(0).image, images[0]); assert.equal(revoked.length, 1)
    f.loader.dispose(); assert.equal(images[0].src, '')
  } finally { await f.restore(); globalThis.Image = originalImage; URL.revokeObjectURL = revoke }
})
test('download deadlines exhaust exactly one retry and stop admission', async () => {
  const f = fixture({ frameCount: 1, timeoutMs: 20 })
  try {
    f.loader.prepareAll(); await sleep(210)
    assert.equal(f.fetches.length, 2); assert.ok(f.fetches.every(r => r.signal.aborted))
    assert.equal(f.loader.isUnavailable(0), true); assert.equal(f.loader.stats.pending, 0)
  } finally { await f.restore() }
})
