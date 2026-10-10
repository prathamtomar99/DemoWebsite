import { writeFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { loadavg, platform, arch } from 'node:os'

// Use already-installed external audit tooling; never alter application dependencies.
const root = process.env.LIGHTHOUSE_TOOLS_ROOT
if (!root) throw new Error('Set LIGHTHOUSE_TOOLS_ROOT to the node_modules directory containing lighthouse and chrome-launcher.')
const { default: lighthouse } = await import(pathToFileURL(resolve(root, 'lighthouse/core/index.js')).href)
const launcher = await import(pathToFileURL(resolve(root, 'chrome-launcher/dist/index.js')).href)
const output = process.argv[2] ?? 'artifacts/batch7'
mkdirSync(output, { recursive: true })
const results = []
for (let pair = 1; pair <= 5; pair++) {
  const chrome = await launcher.launch({ chromeFlags: ['--headless', '--no-first-run'], logLevel: 'silent' })
  try {
    for (const cache of ['cold', 'warm']) {
      const started = new Date().toISOString(), loadBefore = loadavg()
      const { lhr, artifacts } = await lighthouse('http://127.0.0.1:4173/', {
        port: chrome.port, logLevel: 'error', output: 'json',
        onlyCategories: ['performance','accessibility','best-practices','seo'],
        throttlingMethod: 'simulate', disableStorageReset: cache === 'warm',
      })
      if (lhr.runtimeError) throw new Error(JSON.stringify(lhr.runtimeError))
      writeFileSync(`${output}/${pair}-${cache}.json`, JSON.stringify(lhr, null, 2))
      const trace = artifacts.Trace?.traceEvents ?? []
      const log = artifacts.DevtoolsLog ?? []
      const responseEvents = log.filter(e => e.method === 'Network.responseReceived')
      const row = { pair, cache, started, loadBefore, loadAfter: loadavg(), platform: platform(), arch: arch(),
        version: lhr.lighthouseVersion, browser: lhr.environment.hostUserAgent, settings: lhr.configSettings,
        scores: Object.fromEntries(Object.entries(lhr.categories).map(([k,v])=>[k,Math.round(v.score*100)])),
        metrics: Object.fromEntries(['first-contentful-paint','largest-contentful-paint','total-blocking-time','speed-index','cumulative-layout-shift','total-byte-weight'].map(k=>[k,lhr.audits[k].numericValue])),
        lcp: lhr.audits['lcp-breakdown-insight']?.details,
        mainThread: lhr.audits['mainthread-work-breakdown']?.details,
        cachedResponses: responseEvents.filter(e=>e.params.response.fromDiskCache).length,
        servedFromCacheEvents: log.filter(e=>e.method==='Network.requestServedFromCache').length,
        frames: responseEvents.filter(e=>/\/frames\/frame_/.test(e.params.response.url)).map(e=>({url:e.params.response.url,cache:!!e.params.response.fromDiskCache})),
        trace: Object.fromEntries(['Decode Image','ImageDecodeTask','Paint','Layout','FunctionCall'].map(name=>{const es=trace.filter(e=>e.name===name&&e.ph==='X');return [name,{count:es.length,totalMs:es.reduce((n,e)=>n+(e.dur??0)/1000,0),maxMs:Math.max(0,...es.map(e=>(e.dur??0)/1000))}]})),
      }
      results.push(row)
      writeFileSync(`${output}/measurements.json`,JSON.stringify(results,null,2))
      console.log(JSON.stringify({pair,cache,score:row.scores.performance,lcp:row.metrics['largest-contentful-paint'],tbt:row.metrics['total-blocking-time'],cached:row.cachedResponses}))
    }
  } finally { await chrome.kill() }
}
