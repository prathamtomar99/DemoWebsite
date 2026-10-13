import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import os from 'node:os'
import { buildExperiments, configurations as experiments, integrationConfigurations, inventory } from './build.mjs'
import { serveExperiments } from './server.mjs'
import { installProbe, snapshot, checkScrolling } from './browser-probe.mjs'
import { measure } from './metrics.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright')
const args = process.argv.slice(2), option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
const output = resolve(option('--output', `artifacts/frame-concurrency/${new Date().toISOString().replace(/[:.]/g, '-')}`))
if (existsSync(output)) throw new Error('Use a new output directory; existing benchmark results are never overwritten')
const trials = Number(option('--trials', '5')), networks = option('--networks', 'normal,throttled').split(',')
if (!Number.isInteger(trials) || trials < 1 || networks.some(n => !['normal', 'throttled'].includes(n))) throw new Error('Invalid benchmark arguments')
const configurations = args.includes('--integration') ? integrationConfigurations : experiments
const before = inventory()
await buildExperiments(output, configurations)
const hosted = await serveExperiments(output)
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const environment = { browser: browser.version(), node: process.version, platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, installedMemoryBytes: os.totalmem(), startedAt: new Date().toISOString(), trials, networks, origin: hosted.url,
  normal: { downloadBytesPerSecond: 'unlimited localhost', latencyMs: 0, cpuRate: 1 },
  throttled: { downloadBytesPerSecond: 200000, uploadBytesPerSecond: 100000, latencyMs: 100, cpuRate: 4 },
  cachePolicy: 'public, max-age=0, must-revalidate; ETag; fresh context and Network.clearBrowserCache for every cold trial',
  buffer: { reservedSlots: 8, maximumBytesPerFrame: args.includes('--integration') ? 262144 : 131072, maximumDecodes: 2 },
  transport: 'Local HTTP/1.1; gzip HTML/JS/CSS/JSON; original public frame bytes and paths; not Vercel' }
writeFileSync(join(output, 'environment.json'), JSON.stringify(environment, null, 2))
mkdirSync(join(output, 'raw'))
const results = []
console.log(JSON.stringify({ output, environment }))

async function runPair(config, mobile, networkName, trial, live = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 375, height: 812 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, reducedMotion: 'no-preference' })
  await context.addInitScript(installProbe)
  const page = await context.newPage(), cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable'); await cdp.send('Performance.enable'); await cdp.send('Network.clearBrowserCache')
  if (networkName === 'throttled') {
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 200000, uploadThroughput: 100000 })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  }
  let coldSuccess = false
  try {
    for (const cache of ['cold', 'warm']) {
      const requests = new Map(), errors = [], consoleMessages = [], pageErrors = []
      let bytes = 0
      const request = e => requests.set(e.requestId, { url: e.request.url, start: e.timestamp, priority: e.request.initialPriority })
      const response = e => { const r = requests.get(e.requestId); if (r) Object.assign(r, { status: e.response.status, fromDiskCache: e.response.fromDiskCache, protocol: e.response.protocol, headers: e.response.headers }) }
      const finished = e => { bytes += e.encodedDataLength; const r = requests.get(e.requestId); if (r) Object.assign(r, { end: e.timestamp, bytes: e.encodedDataLength }) }
      const failed = e => errors.push({ url: requests.get(e.requestId)?.url, error: e.errorText })
      const consoleListener = m => { if (['warning', 'error'].includes(m.type())) consoleMessages.push({ type: m.type(), text: m.text() }) }
      const errorListener = e => pageErrors.push(String(e))
      cdp.on('Network.requestWillBeSent', request); cdp.on('Network.responseReceived', response); cdp.on('Network.loadingFinished', finished); cdp.on('Network.loadingFailed', failed)
      page.on('console', consoleListener); page.on('pageerror', errorListener)
      let waitError = null, raw, correctness = null
      const beforeMetrics = (await cdp.send('Performance.getMetrics')).metrics
      const beforeTask = beforeMetrics.find(m => m.name === 'TaskDuration')?.value ?? 0
      const url = live ? 'https://demo-website-nine-tan.vercel.app/' : `${hosted.url}?bench=${config}`
      try {
        if (cache === 'cold') await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
        else await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
        await page.waitForFunction(() => document.querySelector('#home')?.dataset.preparing === 'false', null, { timeout: 55000 })
        await page.waitForTimeout(220)
      } catch (error) { waitError = String(error) }
      raw = await page.evaluate(snapshot)
      const taskMetrics = (await cdp.send('Performance.getMetrics')).metrics
      const network = { requests: requests.size, transferredBytes: bytes, failures: errors, pageErrors, consoleMessages,
        frameResponses: [...requests.values()].filter(r => r.url.includes('/frame_')),
        mainThreadTaskMs: 1000 * Math.max(0, (taskMetrics.find(m => m.name === 'TaskDuration')?.value ?? 0) - beforeTask) }
      const metrics = measure(raw, network)
      // Stop startup network accounting before scrolling/lazy images begin.
      cdp.off('Network.requestWillBeSent', request); cdp.off('Network.responseReceived', response); cdp.off('Network.loadingFinished', finished); cdp.off('Network.loadingFailed', failed)
      if (metrics.success) {
        if (trial === 1 && cache === 'cold' && networkName === 'normal') await page.screenshot({ path: join(output, `${live ? 'live-' : ''}${config}-${mobile ? 'mobile' : 'desktop'}.png`) })
        correctness = await page.evaluate(checkScrolling)
      }
      const concurrencyLimit = config === 'production' ? 2 : Number(config.at(-1))
      const violations = []
      if (metrics.concurrency?.peakDownloads > concurrencyLimit) violations.push('Download concurrency exceeded')
      if (metrics.concurrency?.peakDecodes > 2) violations.push('Decode concurrency exceeded')
      if (metrics.compressedBufferPeakFrames > 8) violations.push('Compressed buffer exceeded')
      if (metrics.success && (metrics.frameCalls !== (mobile ? 60 : 72) || metrics.decodeCalls !== (mobile ? 60 : 72))) violations.push('Duplicate work')
      if (correctness && !correctness.pass) violations.push('Scroll correctness failure')
      if (pageErrors.length) violations.push('Browser page error')
      // Verify actual release of all tracked ImageBitmaps after static-mode cleanup.
      let released = null
      if (cache === 'warm') {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.waitForFunction(() => window.__frameBench.liveBytes === 0 && document.querySelector('#home')?.dataset.static === 'true', null, { timeout: 5000 }).catch(() => {})
        released = await page.evaluate(() => window.__frameBench.liveBytes === 0)
        if (!released) violations.push('Bitmap cleanup failure')
      }
      page.off('console', consoleListener); page.off('pageerror', errorListener)
      const id = `${live ? 'live-' : ''}${networkName}-${mobile ? 'mobile' : 'desktop'}-${config}-${trial}-${cache}`
      const result = { id, config, mobile, networkName, trial, cache, live, timestamp: new Date().toISOString(), hostLoad: os.loadavg(), waitError, metrics, correctness, released, violations }
      writeFileSync(join(output, 'raw', `${id}.json`), JSON.stringify({ ...result, raw }, null, 2))
      results.push(result)
      writeFileSync(join(output, 'results.json'), JSON.stringify(results, null, 2))
      console.log(JSON.stringify({ id, success: metrics.success, canvasMs: metrics.canvasMs, preparationMs: metrics.preparationMs, peak: metrics.concurrency, buffer: metrics.compressedBufferPeakBytes, violations, waitError }))
      if (cache === 'cold') coldSuccess = metrics.success && violations.length === 0
    }
  } finally { await context.close() }
  return coldSuccess
}

try {
  for (const networkName of networks) for (const mobile of [false, true]) {
    const successful = new Map(configurations.map(c => [c, 0]))
    for (let round = 0; round < trials + 3 && [...successful.values()].some(n => n < trials); round++) {
      const offset = (round + Number(mobile) + Number(networkName === 'throttled')) % configurations.length
      const order = configurations.map((_, i) => configurations[(i + offset) % configurations.length])
      for (const config of order) {
        if (successful.get(config) >= trials) continue
        if (await runPair(config, mobile, networkName, round + 1)) successful.set(config, successful.get(config) + 1)
      }
    }
  }
  if (args.includes('--live')) for (const mobile of [false, true]) await runPair('production', mobile, 'normal', 1, true)
} finally {
  await browser.close()
  await new Promise(resolve => hosted.server.close(resolve))
  const unchanged = JSON.stringify(before) === JSON.stringify(inventory())
  writeFileSync(join(output, 'integrity.json'), JSON.stringify({ productionUnchanged: unchanged, completedAt: new Date().toISOString() }, null, 2))
  if (!unchanged) { console.error('Production source/asset inventory changed'); process.exitCode = 1 }
}
if (results.some(r => !r.metrics.success || r.violations.length || r.waitError)) process.exitCode = 1
console.log(`Results: ${output}`)
