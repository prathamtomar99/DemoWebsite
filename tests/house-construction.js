// oxlint-disable-next-line no-unused-expressions -- trusted Playwright function, run by scripts/run-browser-suites.mjs.
async page => {
  const check = (value, message) => { if (!value) throw Error(message) }
  const labels = ['Preparing the site', 'Laying the groundwork', 'Building the foundation', 'Raising the structure', 'Shaping the residence', 'Finishing the details']
  const errors = [], results = [], engine = page.context().browser().browserType().name()
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 8 })
    const native = createImageBitmap.bind(window), total = innerWidth < 768 ? 60 : 72
    let decoded = 0
    window.__construction = { stages: [], completion: null, decodeWaiting: false }
    window.createImageBitmap = async (...args) => {
      const image = await native(...args)
      if (++decoded === total) {
        window.__construction.decodeWaiting = true
        await new Promise(resolve => { window.__releaseHouseDecode = resolve })
      }
      return image
    }
    new MutationObserver(() => {
      const svg = document.querySelector('.house-construction'), hero = document.querySelector('#home')
      if (!svg) return
      const audit = window.__construction, stage = +svg.dataset.stage
      if (audit.stages.at(-1) !== stage) audit.stages.push(stage)
      if (svg.dataset.complete === 'true') audit.completion = {
        cache: +hero.dataset.cacheSize, ready: document.querySelector('canvas').dataset.ready,
        status: document.querySelector('.preparation-status').textContent, at: performance.now(),
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true })
  })
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 812 })
    const total = width < 768 ? 60 : 72, pending = [], requests = []
    let allowed = 0, failedOnce = false
    await page.route('**/frames/**/*.webp*', async route => {
      const index = +route.request().url().match(/frame_(\d+)/)[1]
      requests.push(index)
      // A genuine retried request must not regress the displayed construction stage.
      if (index === 5 && !failedOnce) { failedOnce = true; await route.abort(); return }
      if (index > allowed) await new Promise(resolve => pending.push({ index, resolve }))
      await route.continue()
    })
    const release = count => {
      allowed = count
      for (let i = pending.length - 1; i >= 0; i--) if (pending[i].index <= allowed) pending.splice(i, 1)[0].resolve()
    }
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.house-construction')
    const stages = []
    for (const [stage, fraction] of [.08, .22, .4, .6, .78, .92].entries()) {
      release(Math.round(total * fraction))
      await page.waitForFunction(count => +document.querySelector('#home').dataset.decodedReady === count, allowed)
      await page.waitForFunction(expected => document.querySelector('.preparation-status')?.textContent === expected, labels[stage])
      // Wait on actual stroke convergence, not an arbitrary animation sleep.
      await page.waitForFunction(() => [...document.querySelectorAll('.construction-line')].every(path =>
        Math.abs(parseFloat(getComputedStyle(path).strokeDashoffset) - parseFloat(path.style.strokeDashoffset)) < .001))
      const state = await page.locator('.house-construction').evaluate(svg => {
        const r = svg.getBoundingClientRect(), content = document.querySelector('.hero-preparation-content').getBoundingClientRect()
        return { stage: +svg.dataset.stage, complete: svg.dataset.complete, width: r.width,
          fits: content.left >= 0 && content.right <= innerWidth && content.top >= 0 && content.bottom <= innerHeight,
          status: document.querySelector('.preparation-status').textContent,
          preparing: document.querySelector('#home').dataset.preparing,
          hidden: svg.getAttribute('aria-hidden'), overflow: document.documentElement.scrollWidth > innerWidth }
      })
      check(state.stage === stage + 1 && state.complete === 'false' && state.preparing === 'true', 'Premature construction/reveal')
      check(state.fits && !state.overflow && state.width <= 320 && state.hidden === 'true', 'SVG sizing/accessibility failed')
      check(await page.locator('.hero-preparation progress, .house-construction image').count() === 0, 'Progress bar or external SVG image added')
      await page.screenshot({ path: `artifacts/house-construction/${engine}-${width}-stage-${stage + 1}.png` })
      stages.push(state)
    }
    // Release all downloads but keep the last native decode out of the retained cache.
    release(total)
    await page.waitForFunction(() => window.__construction.decodeWaiting &&
      +document.querySelector('#home').dataset.decodedReady === (innerWidth < 768 ? 59 : 71))
    check(await page.locator('.house-construction').getAttribute('data-complete') === 'false', 'Completed before the final bitmap was retained')
    check(await page.locator('#home').getAttribute('data-preparing') === 'true', 'Revealed during pending decode')
    // A stalled final decode must leave the illustration in the same incomplete state.
    await page.waitForTimeout(400)
    check(await page.locator('.preparation-status').textContent() === labels[5], 'Stall falsely reached welcome')
    await page.evaluate(() => window.__releaseHouseDecode())
    await page.waitForFunction(() => window.__construction.completion !== null)
    await page.waitForSelector('.hero-preparation', { state: 'detached' })
    const audit = await page.evaluate(() => ({ ...window.__construction, removedAt: performance.now() }))
    check(audit.completion.cache === total && audit.completion.ready === 'true', 'Welcome preceded full cache/Canvas readiness')
    check(audit.completion.status === 'Welcome to Aether Estates', 'Welcome message missing')
    check(audit.removedAt - audit.completion.at < 1000, 'Artificial readiness hold added')
    check(audit.stages.every((stage, i, list) => !i || stage >= list[i - 1]), 'Retry regressed the construction')
    check(requests.length === total + 1 && new Set(requests).size === total, 'Unexpected frame requests beyond one intentional retry')
    await page.unrouteAll({ behavior: 'wait' })
    results.push({ width, stages, audit, requests: requests.length })
  }
  check(errors.length === 0, errors.join('\n'))
  return { results, errors }
}
