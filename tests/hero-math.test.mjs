import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parseManifest, progressFrame, scrollProgress, framePath, publicAsset } from '../src/components/hero/manifest.ts'
import { imagePlacement } from '../src/components/hero/canvas-renderer.ts'

const manifest = parseManifest(JSON.parse(readFileSync(new URL('../public/frames/manifest.json', import.meta.url))))

test('scroll mapping clamps, guards invalid geometry, and is direction-independent', () => {
  for (const progress of [0, .25, .5, .75, 1, .75, .5, .25, 0]) {
    const actual = scrollProgress(-progress * 3600, 4500, 900)
    assert.equal(actual, progress)
    assert.equal(progressFrame(actual, manifest.frameCount), Math.round(progress * (manifest.frameCount - 1)))
  }
  assert.equal(scrollProgress(100, 4500, 900), 0)
  assert.equal(scrollProgress(-5000, 4500, 900), 1)
  assert.equal(scrollProgress(-100, 900, 900), 0)
  assert.equal(scrollProgress(NaN, 4500, 900), 0)
  assert.equal(progressFrame(.5, 1), 0)
})

test('manifest rejects invalid metadata and endpoints; public URLs support a Vite base', () => {
  assert.equal(framePath(manifest, 0), manifest.firstFrame)
  assert.equal(framePath(manifest, manifest.frameCount - 1), manifest.lastFrame)
  assert.equal(publicAsset(manifest.firstFrame, '/aether/'), '/aether/frames/frame_0001.jpg')
  for (const invalid of [null, {}, { ...manifest, frameCount: 0 }, { ...manifest, width: NaN }, { ...manifest, lastFrame: '/frames/wrong.jpg' }]) {
    assert.throws(() => parseManifest(invalid))
  }
  assert.throws(() => publicAsset('/frames/../secret'))
  assert.throws(() => publicAsset('https://example.org/frame.jpg'))
  assert.throws(() => framePath(manifest, manifest.frameCount))
})

test('desktop cover and portrait containment preserve proportions and source watermark area', () => {
  for (const [width, height, fit] of [[1440, 900, 'cover'], [1440, 800, 'cover'], [768, 1024, 'contain'], [375, 812, 'contain'], [2560, 1080, 'contain']]) {
    const placement = imagePlacement(width, height, 1280, 720)
    assert.equal(placement.fit, fit)
    assert.ok(Math.abs(placement.width / placement.height - 16 / 9) < 1e-9)
    // Source watermark centered approximately at (1160,600), retained in frame.
    const watermarkX = placement.x + 1160 * placement.width / 1280
    const watermarkY = placement.y + 600 * placement.height / 720
    assert.ok(watermarkX > 0 && watermarkX < width && watermarkY > 0 && watermarkY < height)
  }
})
