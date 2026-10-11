import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parseManifest, progressFrame, scrollProgress, framePath, frameUrl, publicAsset } from '../src/components/hero/manifest.ts'
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
  assert.equal(publicAsset(manifest.firstFrame, '/aether/'), `/aether${manifest.firstFrame}`)
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


test('both generated profiles cover the source endpoints with strictly increasing uniform samples', () => {
  for (const [profile,count,width,height] of [['desktop',72,960,540],['mobile',60,720,405]]) {
    const data=JSON.parse(readFileSync(new URL(`../public/frames/v2/${profile}/manifest.json`,import.meta.url)))
    const m=parseManifest(data)
    assert.equal(m.frameCount,count)
    assert.equal(m.width,width)
    assert.equal(m.height,height)
    assert.equal(data.sourceFrameIndices[0],0)
    assert.equal(data.sourceFrameIndices.at(-1),data.source.decodedFrameCount-1)
    assert.equal(data.frameTimesSeconds.length,count)
    for(let i=0;i<count;i++) {
      assert.ok(Math.abs(data.frameTimesSeconds[i]-i*data.frameTimesSeconds.at(-1)/(count-1)) <= 1/data.source.actualAverageFps)
      if(i) assert.ok(data.sourceFrameIndices[i]>data.sourceFrameIndices[i-1])
      assert.ok(readFileSync(new URL(`../public${framePath(m,i)}`,import.meta.url)).length>0)
    }
  }
})


test('asset fingerprints invalidate regenerated frames without changing frame mapping', () => {
  const original={...manifest,assetVersion:'0123456789abcdef'}
  const replacement={...manifest,assetVersion:'fedcba9876543210'}
  assert.notEqual(frameUrl(original,0),frameUrl(replacement,0))
  assert.equal(framePath(original,0),framePath(replacement,0))
  assert.equal(frameUrl(original,0,'/demo/'),`/demo${manifest.firstFrame}?v=0123456789abcdef`)
  assert.equal(frameUrl({...manifest,assetVersion:undefined},0),manifest.firstFrame)
  for(const value of ['../other','bad?query',5,''])assert.throws(()=>parseManifest({...manifest,assetVersion:value}))
})
