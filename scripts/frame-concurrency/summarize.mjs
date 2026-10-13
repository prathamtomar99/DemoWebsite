import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

import { summary } from './metrics.mjs'
const output = resolve(process.argv[2]), results = JSON.parse(readFileSync(join(output, 'results.json')))
const configurations = [...new Set(results.filter(r => !r.live).map(r => r.config))]
const groups = []
for (const networkName of ['normal', 'throttled']) for (const mobile of [false, true]) {
  const baseline = results.filter(r => !r.live && r.config === 'production' && r.mobile === mobile && r.networkName === networkName && r.cache === 'cold' && r.metrics.success)
  const baselineMedian = summary(baseline.map(r => r.metrics.canvasMs)).median
  for (const config of configurations) {
    const all = results.filter(r => !r.live && r.config === config && r.mobile === mobile && r.networkName === networkName)
    if (!all.length) continue
    const coldAll = all.filter(r => r.cache === 'cold'), cold = coldAll.filter(r => r.metrics.success), warm = all.filter(r => r.cache === 'warm' && r.metrics.success)
    const metric = key => summary(cold.map(r => r.metrics[key]))
    const readiness = metric('canvasMs')
    groups.push({ networkName, mobile, config, coldReadiness: readiness, warmReadiness: summary(warm.map(r => r.metrics.canvasMs)),
      firstDownload: metric('firstDownloadMs'), downloaded: metric('allDownloadedMs'), decoded: metric('allDecodedMs'), retained: metric('allRetainedMs'), reveal: metric('revealMs'), removed: metric('removedMs'), preparation: metric('preparationMs'), manifest: metric('manifestMs'),
      improvementPercent: 100 * (baselineMedian - readiness.median) / baselineMedian,
      pairedImprovementPercent: summary(cold.map(r => { const b = baseline.find(b => b.trial === r.trial); return b ? 100 * (b.metrics.canvasMs - r.metrics.canvasMs) / b.metrics.canvasMs : NaN })),
      peakDownloads: Math.max(...all.map(r => r.metrics.concurrency?.peakDownloads ?? 0)), peakDecodes: Math.max(...all.map(r => r.metrics.concurrency?.peakDecodes ?? 0)),
      actualNetworkPeak: Math.max(...cold.map(r => r.metrics.networkConcurrency?.peakDownloads ?? 0)),
      averageDownloads: summary(cold.map(r => r.metrics.concurrency?.averageDownloads)), averageDecodes: summary(cold.map(r => r.metrics.concurrency?.averageDecodes)),
      overlapMs: summary(cold.map(r => r.metrics.concurrency?.overlapMs)),
      downloadQueueWaitMedian: summary(cold.map(r => r.metrics.downloadQueueWaitMs.median)), decodeQueueWaitMedian: summary(cold.map(r => r.metrics.decodeQueueWaitMs.median)),
      peakBitmapBytes: Math.max(...all.map(r => r.metrics.peakBitmapBytes)), peakCompressedBufferBytes: Math.max(...all.map(r => r.metrics.compressedBufferPeakBytes)), peakCompressedWithDecodeBytes: Math.max(...all.map(r => r.metrics.compressedIncludingDecodePeakBytes)),
      compressedBufferFrames: Math.max(...all.map(r => r.metrics.compressedBufferPeakFrames)),
      successfulCold: cold.length, attemptedCold: coldAll.length, successfulWarm: warm.length, attempts: all.length,
      retries: all.reduce((n, r) => n + r.metrics.retries, 0), failures: all.filter(r => !r.metrics.success || r.waitError).length,
      correctnessFailures: all.filter(r => r.violations.length).map(r => ({ id: r.id, violations: r.violations })),
      coldLongTasks: cold.map(r => r.metrics.longTasks), warmLongTasks: warm.map(r => r.metrics.longTasks),
      scrollFrameGaps: summary(all.flatMap(r => r.correctness?.traversal?.gaps ?? [])), scrollLongTasks: all.flatMap(r => r.correctness?.traversal?.longTasks ?? []),
      warnings: [...new Set(all.flatMap(r => r.metrics.network.consoleMessages.map(m => m.text)))],
      coldFrameBytes: [...new Set(cold.map(r => r.metrics.frameResourceBytes))], warmTransferredFrameBytes: [...new Set(warm.map(r => r.metrics.frameTransferredBytes))],
      coldRequests: [...new Set(cold.map(r => r.metrics.network.requests))], warmRequests: [...new Set(warm.map(r => r.metrics.network.requests))],
      sampleIds: all.map(r => r.id),
    })
  }
}
writeFileSync(join(output, 'summary.json'), JSON.stringify({ groups, live: results.filter(r => r.live) }, null, 2))
for (const networkName of ['normal', 'throttled']) for (const mobile of [false, true]) {
  console.log(`\n${networkName} / ${mobile ? 'mobile' : 'desktop'} (milliseconds)`)
  console.log('| Configuration | Median cold | Empirical p95 | Fastest | Slowest | Warm median | Download complete | Decode complete | Improvement | Peaks D/C | Buffer KiB | Success |')
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const g of groups.filter(g => g.networkName === networkName && g.mobile === mobile)) {
    const f = n => n?.toFixed(1) ?? '—'
    console.log(`| ${g.config} | ${f(g.coldReadiness.median)} | ${f(g.coldReadiness.p95)} | ${f(g.coldReadiness.min)} | ${f(g.coldReadiness.max)} | ${f(g.warmReadiness.median)} | ${f(g.downloaded.median)} | ${f(g.decoded.median)} | ${f(g.improvementPercent)}% | ${g.peakDownloads}/${g.peakDecodes} | ${f(g.peakCompressedBufferBytes / 1024)} | ${g.successfulCold}/${g.attemptedCold} |`)
  }
}
console.log(`\nSummary: ${join(output, 'summary.json')}`)
