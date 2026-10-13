import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
import { installProbe } from './browser-probe.mjs'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright')
const output = resolve(process.argv[2]), results = []
mkdirSync(output, { recursive: true })
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' })
await server.listen()
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(installProbe)
  await context.addInitScript(() => {
    const originalFetch = fetch, originalDecode = createImageBitmap
    window.__strict = { manifests: 0, held: [], closed: 0 }
    window.fetch = (...args) => { if (String(args[0]).includes('manifest.json')) window.__strict.manifests++; return originalFetch(...args) }
    window.createImageBitmap = (...args) => new Promise((resolve, reject) => {
      window.__strict.held.push(() => originalDecode(...args).then(resolve, reject))
    })
  })
  const page = await context.newPage(), errors = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__strict.held.length === 2)
  const before = await page.evaluate(() => ({ manifests: window.__strict.manifests, decodes: window.__strict.held.length, preparing: document.querySelector('#home').dataset.preparing }))
  assert.ok(before.manifests >= 2, 'Development StrictMode did not exercise setup/cleanup/setup')
  assert.equal(before.preparing, 'true')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForFunction(() => document.querySelector('#home').dataset.static === 'true')
  await page.evaluate(() => window.__strict.held.forEach(release => release()))
  await page.waitForFunction(() => window.__frameBench.decodes.length === 2 && window.__frameBench.decodes.every(d => d.end) && window.__frameBench.liveCount === 0, null, { timeout: 5000 })
  assert.deepEqual(errors, [])
  results.push({ scenario: 'development StrictMode setup/cleanup and late native decode release', pass: true, before, final: await page.evaluate(() => ({ live: window.__frameBench.liveCount, cache: document.querySelector('#home').dataset.cacheSize, static: document.querySelector('#home').dataset.static })), errors })
  await context.close()
} catch (error) { results.push({ pass: false, error: String(error), stack: error.stack }); process.exitCode = 1 }
finally { await browser.close(); await server.close(); writeFileSync(join(output, 'strictmode.json'), JSON.stringify(results, null, 2)); console.log(JSON.stringify(results)) }
