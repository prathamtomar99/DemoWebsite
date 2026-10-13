import { createRequire } from 'node:module'
import { writeFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import assert from 'node:assert/strict'

import { serveExperiments } from './server.mjs'
import { installProbe } from './browser-probe.mjs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright')
const output = resolve(process.argv[2]), hosted = await serveExperiments(output)
const configurations = readdirSync(join(output, 'builds'))
const browser = await chromium.launch({ headless: true, channel: 'chrome' }), results = []
try {
  for (const config of configurations) for (const scenario of ['retry', 'permanent', 'corrupt', 'memory', 'reduced-motion', 'save-data', 'bypass', 'suspend', 'visibility', 'full-gate', 'dimensions', 'oversize', 'job-timeout', 'deadline']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: scenario === 'reduced-motion' ? 'reduce' : 'no-preference' })
    await context.addInitScript(installProbe)
    if (scenario === 'memory') await context.addInitScript(() => Object.defineProperty(navigator, 'deviceMemory', { value: 2 }))
    if (scenario === 'save-data') await context.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: Object.assign(new EventTarget(), { saveData: true }) }))
    const page = await context.newPage(); let attempts = 0
    try {
      if (['retry', 'permanent', 'corrupt'].includes(scenario)) await page.route('**/frame_0005.webp*', route => {
        attempts++
        if (scenario === 'retry') return attempts === 1 ? route.abort() : route.continue()
        return route.fulfill({ status: scenario === 'permanent' ? 404 : 200, contentType: 'image/webp', body: 'intentional invalid frame' })
      })
      if (['bypass', 'suspend', 'visibility'].includes(scenario)) await page.route('**/frame_*.webp*', async route => {
        await new Promise(r => setTimeout(r, 35)); await route.continue().catch(() => {})
      })
      let release
      if (scenario === 'full-gate') await page.route('**/frame_0072.webp*', route => new Promise(resolve => { release = async () => { await route.continue(); resolve() } }))
      if (scenario === 'dimensions') await page.route('**/frame_0005.webp*', route => { attempts++; return route.fulfill({ path: 'public/frames/v2/mobile/frame_0005.webp', contentType: 'image/webp' }) })
      if (scenario === 'oversize') await page.route('**/frame_0005.webp*', route => { attempts++; return route.fulfill({ body: Buffer.alloc(262145), contentType: 'image/webp' }) })
      if (scenario === 'job-timeout') { await page.clock.install(); await page.route('**/frame_0001.webp*', () => { attempts++ }) }
      if (scenario === 'deadline') { await page.clock.install(); await page.route('**/frames/manifest.json', () => {}) }
      await page.goto(`${hosted.url}?bench=${config}`, { waitUntil: 'domcontentloaded' })
      if (scenario === 'deadline') {
        await page.waitForSelector('.hero-preparation'); await page.clock.fastForward(3000)
        assert.equal(await page.locator('#home').getAttribute('data-preparing'), 'true')
        await page.clock.fastForward(43000); await page.clock.runFor(100)
      }
      if (scenario === 'full-gate') {
        await page.waitForFunction(() => +document.querySelector('#home').dataset.decodedReady === 71)
        assert.equal(await page.locator('#home').getAttribute('data-preparing'), 'true')
        assert.notEqual(await page.locator('canvas').getAttribute('data-ready'), 'true')
        await release()
      }
      if (scenario === 'job-timeout') {
        await page.waitForFunction(() => +document.querySelector('#home').dataset.decodedReady === 71)
        await page.clock.fastForward(12200); await page.clock.runFor(200)
        await page.waitForFunction(() => window.__frameBench.downloads.length >= 73)
        await page.clock.fastForward(12200); await page.clock.runFor(200)
      }
      if (scenario === 'visibility') {
        await page.waitForFunction(() => +document.querySelector('#home').dataset.decodedReady > 2)
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
        await page.waitForFunction(() => +document.querySelector('#home').dataset.inflight === 0)
        const count = await page.evaluate(() => window.__frameBench.downloads.length)
        await page.waitForTimeout(150)
        assert.equal(await page.evaluate(() => window.__frameBench.downloads.length), count)
        await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')) })
      }
      if (scenario === 'bypass') {
        await page.waitForFunction(() => +document.querySelector('#home').dataset.decodedReady > 2)
        await page.getByRole('link', { name: 'Continue without the film' }).click()
      }
      if (scenario === 'suspend') {
        await page.waitForFunction(() => +document.querySelector('#home').dataset.decodedReady > 2)
        await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide')))
        await page.waitForTimeout(100)
        await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow')))
      }
      await page.waitForFunction(() => document.querySelector('#home')?.dataset.preparing === 'false', null, { timeout: 15000 })
      if (!['retry', 'suspend', 'visibility', 'full-gate'].includes(scenario)) await page.waitForFunction(() => window.__frameBench.liveCount === 0, null, { timeout: 5000 })
      const state = await page.evaluate(() => ({ hero: { ...document.querySelector('#home').dataset }, canvas: { ...document.querySelector('canvas').dataset }, requests: window.__frameBench.downloads.length, live: window.__frameBench.liveCount }))
      if (['retry', 'suspend', 'visibility', 'full-gate'].includes(scenario)) {
        assert.equal(state.hero.static, 'false'); assert.equal(state.live, 72); assert.equal(state.canvas.ready, 'true')
      } else {
        assert.equal(state.hero.static, 'true'); assert.equal(state.live, 0)
      }
      if (['retry', 'permanent', 'corrupt', 'dimensions', 'job-timeout'].includes(scenario) || scenario === 'oversize' && config === 'integrated-4') assert.equal(attempts, 2)
      if (['memory', 'reduced-motion', 'save-data'].includes(scenario)) assert.equal(state.requests, 0)
      if (scenario === 'job-timeout') assert.equal(state.hero.preparationFailure, 'frame-failed-after-retry')
      if (scenario === 'deadline') assert.equal(state.hero.preparationFailure, 'safety-timeout')
      results.push({ config, scenario, pass: true, attempts, state })
    } catch (error) { results.push({ config, scenario, pass: false, error: String(error), stack: error.stack }) }
    finally { await context.close() }
    console.log(JSON.stringify(results.at(-1)))
    writeFileSync(join(output, 'verification.json'), JSON.stringify(results, null, 2))
  }
} finally { await browser.close(); await new Promise(r => hosted.server.close(r)) }
if (results.some(r => !r.pass)) process.exitCode = 1
