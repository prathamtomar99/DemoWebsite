import { build } from 'vite'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = fileURLToPath(new URL('../../', import.meta.url))
export const baselineRevision = 'f4aaf02e20d72fa0bad3a1bb6e7a656e71ec8d65'
export const integrationConfigurations = ['production', 'integrated-4']
export const configurations = ['production', 'separated-2', 'separated-4', 'separated-6']
const hash = data => createHash('sha256').update(data).digest('hex')
export function inventory() {
  const files = []
  function visit(dir) {
    for (const name of readdirSync(join(root, dir))) {
      const relative = join(dir, name), path = join(root, relative)
      if (statSync(path).isDirectory()) visit(relative)
      else files.push({ path: relative, bytes: statSync(path).size, sha256: hash(readFileSync(path)) })
    }
  }
  for (const dir of ['src', 'public']) visit(dir)
  for (const path of ['index.html', 'vite.config.ts', 'package.json', 'package-lock.json', 'BRIEF.md', 'DESIGN.md', 'MOTION_REFERENCE.md']) {
    files.push({ path, sha256: hash(readFileSync(join(root, path))) })
  }
  return files
}
function replaceOnce(source, needle, replacement) {
  if (source.split(needle).length !== 2) throw new Error(`Benchmark transform drift: ${needle}`)
  return source.replace(needle, replacement)
}
export async function buildExperiments(output, selected = configurations) {
  const before = inventory()
  for (const f of before.filter(f => /\/frame_.*\.webp$/.test(f.path))) {
    if (f.bytes > 128 * 1024) throw new Error(`Frame exceeds buffer reservation: ${f.path}`)
  }
  mkdirSync(output, { recursive: true })
  writeFileSync(join(output, 'source-inventory.json'), JSON.stringify(before, null, 2))
  const baselineFiles = ['frame-loader.ts', 'frame-transport.ts', 'use-hero-sequence.ts']
  const baseline = new Map(baselineFiles.map(file => {
    const path = `src/components/hero/${file}`
    return [path, execFileSync('git', ['show', `${baselineRevision}:${path}`], { cwd: root, encoding: 'utf8' })]
  }))
  writeFileSync(join(output, 'build-provenance.json'), JSON.stringify({ baselineRevision, configurations: selected,
    baseline: [...baseline].map(([path, source]) => ({ path, sha256: hash(source) })),
    candidate: 'Current production source, observation callbacks only; no loader replacement or concurrency transform' }, null, 2))
  for (const config of selected) {
    const integrated = config === 'integrated-4', independent = config.startsWith('separated-'), downloads = integrated ? 4 : independent ? Number(config.at(-1)) : 2
    const plugin = {
      name: 'isolated-frame-concurrency-benchmark', enforce: 'pre',
      load(id) {
        if (!integrated) for (const [path, source] of baseline) if (id === resolve(root, path)) return source
      },
      resolveId(source, importer) {
        if (independent && source === './frame-loader' && importer?.endsWith('/hero/use-hero-sequence.ts')) {
          return resolve(root, 'scripts/frame-concurrency/independent-loader.ts')
        }
      },
      transform(source, id) {
        if (id.endsWith('/hero/frame-transport.ts') && integrated) {
          return replaceOnce(source, 'const blob = await readFrameBlob(response, this.options.maxFrameBytes)', "const blob = await readFrameBlob(response, this.options.maxFrameBytes); globalThis.__frameBenchEvent?.({ type: 'downloaded', index: job.index, blob })")
        }
        if (id.endsWith('/hero/frame-transport.ts') && independent) {
          return replaceOnce(source, 'this.active >= 2', `this.active >= ${downloads}`)
        }
        if (id.endsWith('/hero/frame-loader.ts') && !independent) {
          source = replaceOnce(source, 'this.retaining = true', "globalThis.__frameBenchEvent?.({ type: 'queued', total: this.manifest.frameCount }); this.retaining = true")
          source = replaceOnce(source, 'this.cache.set(index, frame)', "this.cache.set(index, frame); globalThis.__frameBenchEvent?.({ type: 'retained', index })")
          source = replaceOnce(source, 'this.failures.set(index, attempts)', "this.failures.set(index, attempts); globalThis.__frameBenchEvent?.({ type: 'attempt-failed', index, attempts })")
          return source
        }
        if (id.endsWith('/hero/use-hero-sequence.ts')) {
          return replaceOnce(source, 'const started = performance.now()', "const started = performance.now(); globalThis.__frameBenchEvent?.({ type: 'preparation-start' })")
        }
      },
    }
    await build({ root, configFile: resolve(root, 'vite.config.ts'), envDir: false, logLevel: 'warn',
      plugins: [plugin], define: { __BENCH_DOWNLOADS__: String(downloads) },
      build: { outDir: resolve(output, 'builds', config), emptyOutDir: false, copyPublicDir: false } })
  }
  if (JSON.stringify(inventory()) !== JSON.stringify(before)) throw new Error('Production files changed during benchmark build')
}
