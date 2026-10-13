/** Reproduce the original 30 ms assertion, then await actual React teardown. */
import { createRequire } from 'node:module'
import { writeFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

import { serveExperiments } from './server.mjs'
import { installProbe, checkScrolling } from './browser-probe.mjs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright')
const output = resolve(process.argv[2]), hosted = await serveExperiments(output)
const configurations = readdirSync(join(output, 'builds'))
const browser = await chromium.launch({ headless: true, channel: 'chrome' }), results = []
try {
  for (const mobile of [false, true]) for (const config of configurations) {
    const context = await browser.newContext({ viewport: mobile ? { width: 375, height: 812 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })
    await context.addInitScript(installProbe)
    const page = await context.newPage(), cdp = await context.newCDPSession(page)
    try {
      await page.goto(`${hosted.url}?bench=${config}`)
      await page.waitForFunction(() => document.querySelector('canvas')?.dataset.ready === 'true')
      await cdp.send('Network.enable')
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 200000, uploadThroughput: 100000 })
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => document.querySelector('canvas')?.dataset.ready === 'true')
      await page.waitForTimeout(220)
      const scrolling = await page.evaluate(checkScrolling)
      const started = await page.evaluate(() => performance.now())
      await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(30)
      const early = await page.evaluate(() => ({ live: window.__frameBench.liveCount, static: document.querySelector('#home').dataset.static, time: performance.now() }))
      await page.waitForFunction(() => window.__frameBench.liveBytes === 0 && document.querySelector('#home').dataset.static === 'true', null, { timeout: 5000 })
      const final = await page.evaluate(() => ({ live: window.__frameBench.liveCount, bytes: window.__frameBench.liveBytes, static: document.querySelector('#home').dataset.static, lastCloseMs: window.__frameBench.lastCloseMs }))
      results.push({ mobile, config, pass: final.live === 0 && scrolling.pass, early, final, closeElapsedMs: final.lastCloseMs - started })
    } catch (error) { results.push({ mobile, config, pass: false, error: String(error) }) }
    finally { await context.close() }
    console.log(JSON.stringify(results.at(-1)))
    writeFileSync(join(output, 'cleanup-recheck.json'), JSON.stringify(results, null, 2))
  }
} finally { await browser.close(); await new Promise(r => hosted.server.close(r)) }
if (results.some(r => !r.pass)) process.exitCode = 1
