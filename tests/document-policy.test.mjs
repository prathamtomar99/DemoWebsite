import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { siteConfig } from '../src/config/site.ts'

test('concept indexing policy and early poster remain aligned with runtime configuration', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const preload = html.match(/<link[^>]*rel="preload"[^>]*as="image"[^>]*>/g) ?? []
  assert.equal(preload.length, 1, 'Only the poster, never the sequence, should preload')
  assert.ok(preload[0].includes(`href="%BASE_URL%${siteConfig.hero.posterPath.replace(/^\//, '')}"`))
  assert.match(html, /name="robots" content="noindex, nofollow"/)
  assert.doesNotMatch(html, /rel="canonical"|application\/ld\+json/)
  assert.match(readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8'), /Disallow: \/\s*$/)
  assert.ok(existsSync(new URL('../public/favicon.svg', import.meta.url)))
})
