import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { MotionValue } from 'motion/react'
import { FrameTransport } from './frame-transport'
import { decodedSequenceBytes, sequenceBudget } from './full-frame-policy'
import type { PreparationProgress } from './full-frame-policy'
import { FrameLoader, desktopLoader, mobileLoader } from './frame-loader'
import { paintFrame } from './canvas-renderer'
import { parseManifest, publicAsset, scrollProgress } from './manifest'
import type { FrameManifest } from './manifest'
import { frameBlend, availableBlend } from './frame-blend'
import { siteConfig } from '../../config/site'

interface SequenceOptions {
  section: RefObject<HTMLElement | null>
  viewport: RefObject<HTMLDivElement | null>
  canvas: RefObject<HTMLCanvasElement | null>
  progress: MotionValue<number>
  enabled: boolean
  manifestPath: string
  onUnavailable: () => void
  onPrepared: (progress: PreparationProgress) => void
}

export function useHeroSequence({ section, viewport, canvas, progress, enabled, manifestPath, onUnavailable, onPrepared }: SequenceOptions) {
  useEffect(() => {
    const outer = section.current
    const stage = viewport.current
    const surface = canvas.current
    if (!enabled || !outer || !stage || !surface) return
    if (!surface.getContext('2d', { alpha: false })) {
      onUnavailable()
      return
    }
    onPrepared({ downloaded: 0, decoded: 0, total: 0, ready: false })
    const resourceOptions = () => matchMedia('(max-width: 767px), (pointer: coarse)').matches ? mobileLoader : desktopLoader
    let disposed = false
    let near = false
    let pageActive = true
    let raf = 0
    let loader: FrameLoader | undefined
    let transport: FrameTransport | undefined
    let downloaded = 0
    let finished = false
    let failed = false
    const started = performance.now()
    function unavailable(reason: string) {
      if (disposed || failed) return
      failed = true
      outer!.dataset.preparationFailure = reason
      if (import.meta.env.DEV) console.info(`[Hero preparation] ${reason}`)
      onUnavailable()
    }
    function report(ready = false) {
      if (!manifest || disposed || failed || finished) return
      const decoded = loader?.stats.cached ?? 0
      outer!.dataset.decodedReady = String(decoded)
      onPrepared({ downloaded, decoded, total: manifest.frameCount, ready })
      if (ready) {
        finished = true
        clearTimeout(safetyTimeout)
        outer!.dataset.preparationMs = String(performance.now() - started)
      }
    }
    const safetyTimeout = setTimeout(() => unavailable('safety-timeout'), siteConfig.hero.preparationTimeoutMs)
    let manifest: FrameManifest | undefined
    let wanted = -1
    let painted = -1
    let current = -1
    let next = -1
    let lastBase = -1
    let lastOverlay = -1
    let lastAlpha = -1
    let direction = 1
    let lastWidth = 0
    let lastHeight = 0
    let lastDpr = 0
    let renders = 0
    const background = getComputedStyle(stage).backgroundColor
    const abort = new AbortController()
    const manifestTimeout = setTimeout(() => abort.abort('timeout'), siteConfig.hero.preparationTimeoutMs)

    function stats() {
      if (!loader) return
      const values = loader.stats
      outer!.dataset.cacheSize = String(values.cached)
      outer!.dataset.cacheCapacity = String(values.capacity)
      outer!.dataset.inflight = String(values.pending)
    }

    function update() {
      raf = 0
      if (disposed || failed || !pageActive || !near || document.hidden) return
      const rect = outer!.getBoundingClientRect()
      const bounds = stage!.getBoundingClientRect()
      const value = scrollProgress(rect.top, rect.height, bounds.height)
      progress.set(value)
      // Storytelling remains responsive while the manifest or first image loads.
      if (!manifest || !loader || loader.stats.cached !== manifest.frameCount) return
      const resources = resourceOptions()
      const blending = siteConfig.hero.blending
      const sample = frameBlend(value, manifest.frameCount, {
        enabled: resources === mobileLoader ? blending.mobile : blending.desktop,
        start: blending.start, end: blending.end, curve: blending.curve,
      })
      current = sample.current
      next = sample.next
      const index = sample.nearest
      if (index !== wanted) {
        direction = wanted < 0 || index > wanted ? 1 : -1
        wanted = index
        surface!.dataset.wantedFrame = String(index + 1)
      }
      loader.configure(resources)
      loader.want(wanted, direction, current === next ? -1 : wanted === current ? next : current)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const resized = bounds.width !== lastWidth || bounds.height !== lastHeight || dpr !== lastDpr
      const lower = loader.get(current)
      const upper = current === next ? lower : loader.get(next)
      const plan = availableBlend(sample, !!lower, !!upper)
      const image = plan ? (plan.base === current ? lower : upper) : resized ? loader.get(painted) : undefined
      const base = plan?.base ?? painted
      const overlay = plan?.overlay ?? -1
      const alpha = plan?.alpha ?? 0
      surface!.dataset.blendAvailable = String(!!lower && !!upper)
      if (image && (lastBase !== base || lastOverlay !== overlay || lastAlpha !== alpha || resized || surface!.dataset.ready !== 'true')) {
        try {
          if (paintFrame(surface!, image, bounds.width, bounds.height, background, overlay >= 0 ? upper : undefined, alpha)) {
            // A cache miss during resize redraws the last image, never a blank surface.
            if (plan) painted = plan.dominant
            loader.pin(painted)
            lastBase = base
            lastOverlay = overlay
            lastAlpha = alpha
            lastWidth = bounds.width
            lastHeight = bounds.height
            lastDpr = dpr
            surface!.dataset.ready = 'true'
            surface!.dataset.paintedFrame = String(painted + 1)
            surface!.dataset.blendBase = String(base + 1)
            surface!.dataset.blendNext = String(overlay + 1)
            surface!.dataset.blendAlpha = String(alpha)
            surface!.dataset.renderCount = String(++renders)
          }
        } catch {
          surface!.dataset.ready = 'false'
          unavailable('canvas-render-failed')
        }
      }
      if (painted >= 0) report(true)
      stats()
    }

    function schedule() {
      if (!disposed && pageActive && near && !document.hidden && !raf) raf = requestAnimationFrame(update)
    }

    const intersection = new IntersectionObserver(([entry]) => {
      near = entry.isIntersecting
      if (near) { loader?.prepareAll(); schedule() }
      else loader?.suspend()

    }, { rootMargin: '50% 0px' })
    intersection.observe(outer)
    const resize = new ResizeObserver(schedule)
    resize.observe(stage)
    resize.observe(outer)
    const visibility = () => {
      if (document.hidden) loader?.suspend()
      else { loader?.prepareAll(); schedule() }

    }
    const pageHidden = () => {
      pageActive = false
      cancelAnimationFrame(raf)
      raf = 0
      // Navigation can cancel fetches before React unmounts. Do not retry in a departing document.
      loader?.suspend()

    }
    const pageShown = () => {
      pageActive = true
      loader?.prepareAll()
      schedule()
    }
    const contextLost = (event: Event) => {
      event.preventDefault()
      surface.dataset.ready = 'false'
    }
    surface.addEventListener('contextlost', contextLost)
    surface.addEventListener('contextrestored', schedule)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    window.addEventListener('pagehide', pageHidden)
    window.addEventListener('pageshow', pageShown)
    document.addEventListener('visibilitychange', visibility)
    const navigate = () => { if (!finished && location.hash && location.hash !== '#home') unavailable('navigation-bypass') }
    window.addEventListener('hashchange', navigate)

    void fetch(publicAsset(manifestPath), { signal: abort.signal }).then(async (response) => {
      if (!response.ok) throw new Error('Manifest unavailable')
      manifest = parseManifest(await response.json())
      if (disposed) return
      surface.dataset.frameCount = String(manifest.frameCount)
      surface.dataset.manifest = manifestPath
      if (typeof createImageBitmap !== 'function') { unavailable('bitmap-unavailable'); return }
      const bytes = decodedSequenceBytes(manifest.frameCount, manifest.width, manifest.height)
      const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
      const budget = sequenceBudget(manifest.width <= 720, memory,
        siteConfig.hero.decodedBudgetMiB.desktop, siteConfig.hero.decodedBudgetMiB.mobile)
      outer.dataset.decodedBytes = String(bytes)
      outer.dataset.decodedBudget = String(budget)
      if (bytes > budget) { unavailable('memory-budget'); return }
      const options = { ...resourceOptions(), maxFrames: manifest.frameCount, maxBytes: budget }
      transport = new FrameTransport(manifest, count => {
        downloaded = count
        outer.dataset.compressedReady = String(count)
        report()
      })
      loader = new FrameLoader(manifest, options, transport, (_index, frameFailed) => {
        if (disposed) return
        stats()
        report()
        if (frameFailed) unavailable('frame-failed-after-retry')
        else schedule()
      })
      if (near && pageActive && !document.hidden) loader.prepareAll()
      report()
      schedule()
    }).catch(() => {
      if (!disposed) unavailable('manifest-unavailable')
    }).finally(() => clearTimeout(manifestTimeout))

    return () => {
      disposed = true
      abort.abort()
      clearTimeout(manifestTimeout)
      cancelAnimationFrame(raf)
      intersection.disconnect()
      resize.disconnect()
      loader?.dispose()
      transport?.dispose()
      clearTimeout(safetyTimeout)
      window.removeEventListener('hashchange', navigate)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('pagehide', pageHidden)
      window.removeEventListener('pageshow', pageShown)
      document.removeEventListener('visibilitychange', visibility)
      surface.removeEventListener('contextlost', contextLost)
      surface.removeEventListener('contextrestored', schedule)
      surface.dataset.ready = 'false'
      delete surface.dataset.paintedFrame
      delete surface.dataset.wantedFrame
      outer.dataset.cacheSize = '0'
      outer.dataset.inflight = '0'
      // Release backing-store memory after the poster is exposed.
      surface.width = 1
      surface.height = 1
    }
  }, [section, viewport, canvas, progress, enabled, manifestPath, onUnavailable, onPrepared])
}
