import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { MotionValue } from 'motion/react'
import { FrameTransport, connectionAllowsWarmup } from './frame-transport'
import type { FrameConnection } from './frame-transport'
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
  onPrepared: (count: number) => void
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
    const resourceOptions = () => matchMedia('(max-width: 767px), (pointer: coarse)').matches ? mobileLoader : desktopLoader
    let disposed = false
    let near = false
    let pageActive = true
    let raf = 0
    let loader: FrameLoader | undefined
    let transport: FrameTransport | undefined
    let prepared = 0
    const connection = (navigator as Navigator & { connection?: FrameConnection }).connection
    function warm() {
      transport?.warm(siteConfig.hero.preparation && prepared >= 3 && near && pageActive && !document.hidden &&
        document.readyState === 'complete' && connectionAllowsWarmup(connection))
    }
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
    const manifestTimeout = setTimeout(() => abort.abort('timeout'), 12000)

    function stats() {
      if (!loader) return
      const values = loader.stats
      outer!.dataset.cacheSize = String(values.cached)
      outer!.dataset.cacheCapacity = String(values.capacity)
      outer!.dataset.inflight = String(values.pending)
    }

    function update() {
      raf = 0
      if (disposed || !pageActive || !near || document.hidden) return
      const rect = outer!.getBoundingClientRect()
      const bounds = stage!.getBoundingClientRect()
      const value = scrollProgress(rect.top, rect.height, bounds.height)
      progress.set(value)
      // Storytelling remains responsive while the manifest or first image loads.
      if (!manifest || !loader) return
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
          onUnavailable()
        }
      }
      if (painted >= 0 && prepared < 3) {
        const count = Math.min(3, loader.stats.cached)
        if (count !== prepared) { prepared = count; onPrepared(count); warm() }
      }
      stats()
    }

    function schedule() {
      if (!disposed && pageActive && near && !document.hidden && !raf) raf = requestAnimationFrame(update)
    }

    const intersection = new IntersectionObserver(([entry]) => {
      near = entry.isIntersecting
      if (near) schedule()
      else loader?.suspend()
      warm()
    }, { rootMargin: '50% 0px' })
    intersection.observe(outer)
    const resize = new ResizeObserver(schedule)
    resize.observe(stage)
    resize.observe(outer)
    const visibility = () => {
      if (document.hidden) loader?.suspend()
      else schedule()
      warm()
    }
    const pageHidden = () => {
      pageActive = false
      cancelAnimationFrame(raf)
      raf = 0
      // Navigation can cancel fetches before React unmounts. Do not retry in a departing document.
      loader?.suspend()
      warm()
    }
    const pageShown = () => {
      pageActive = true
      warm()
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
    window.addEventListener('load', warm)
    connection?.addEventListener('change', warm)

    void fetch(publicAsset(manifestPath), { signal: abort.signal }).then(async (response) => {
      if (!response.ok) throw new Error('Manifest unavailable')
      manifest = parseManifest(await response.json())
      if (disposed) return
      surface.dataset.frameCount = String(manifest.frameCount)
      surface.dataset.manifest = manifestPath
      const options = resourceOptions()
      transport = new FrameTransport(manifest, count => { outer.dataset.compressedReady = String(count) })
      loader = new FrameLoader(manifest, options, transport, (index, failed) => {
        if (disposed) return
        stats()
        if (failed && painted < 0 && loader?.isUnavailable(current) && loader.isUnavailable(next)) onUnavailable()
        else if (index === current || index === next || prepared < 3) schedule()
      })
      schedule()
    }).catch(() => {
      if (!disposed) onUnavailable()
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
      window.removeEventListener('load', warm)
      connection?.removeEventListener('change', warm)
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
