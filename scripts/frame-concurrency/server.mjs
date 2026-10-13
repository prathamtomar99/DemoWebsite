import { createServer } from 'node:http'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { root } from './build.mjs'

/** One origin and identical frame URLs/cache policy for every local configuration. */
export async function serveExperiments(output) {
  const files = new Map(), documents = new Map()
  function collect(dir, prefix = '') {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name), url = `${prefix}/${name}`
      if (statSync(path).isDirectory()) collect(path, url)
      else add(url, readFileSync(path))
    }
  }
  function add(url, bytes) {
    const types = { js: 'text/javascript', css: 'text/css', html: 'text/html', json: 'application/json', webp: 'image/webp', woff2: 'font/woff2', svg: 'image/svg+xml', jpg: 'image/jpeg', txt: 'text/plain' }
    const type = types[url.split('.').at(-1)] || 'application/octet-stream'
    const compress = /javascript|text\/|json|svg/.test(type)
    const body = compress ? gzipSync(bytes) : bytes
    files.set(url, { body, type, compress, etag: `"${createHash('sha256').update(body).digest('hex')}"` })
  }
  collect(resolve(root, 'public'))
  for (const config of readdirSync(resolve(output, 'builds'))) {
    const dir = resolve(output, 'builds', config)
    collect(join(dir, 'assets'), '/assets')
    add(`/__document-${config}.html`, readFileSync(join(dir, 'index.html')))
    documents.set(config, files.get(`/__document-${config}.html`))
  }
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const file = url.pathname === '/' ? documents.get(url.searchParams.get('bench') || 'production') : files.get(url.pathname)
    if (!file) { res.writeHead(404); res.end('Not found'); return }
    const headers = { 'Content-Type': file.type, 'Cache-Control': 'public, max-age=0, must-revalidate', ETag: file.etag, Vary: 'Accept-Encoding', ...(file.compress ? { 'Content-Encoding': 'gzip' } : {}) }
    if (req.headers['if-none-match'] === file.etag) { res.writeHead(304, headers); res.end(); return }
    res.writeHead(200, { ...headers, 'Content-Length': file.body.length })
    res.end(file.body)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return { server, url: `http://127.0.0.1:${server.address().port}/` }
}
