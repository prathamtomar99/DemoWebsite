import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { MotionValue } from 'motion/react'
import { FrameLoader, desktopLoader, mobileLoader } from './frame-loader'
import { paintFrame } from './canvas-renderer'
import { parseManifest, publicAsset, progressFrame, scrollProgress } from './manifest'
import type { FrameManifest } from './manifest'

interface SequenceOptions {
  section: RefObject<HTMLElement | null>
  viewport: RefObject<HTMLDivElement | null>
  canvas: RefObject<HTMLCanvasElement | null>
  progress: MotionValue<number>
  enabled: boolean
  manifestPath: string
  onUnavailable: () => void
}

export function useHeroSequence({ section, viewport, canvas, progress, enabled, manifestPath, onUnavailable }: SequenceOptions) {
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
    let raf = 0
    let loader: FrameLoader | undefined
    let manifest: FrameManifest | undefined
    let wanted = -1
    let painted = -1
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
      if (disposed || !near || document.hidden) return
      const rect = outer!.getBoundingClientRect()
      const bounds = stage!.getBoundingClientRect()
      const value = scrollProgress(rect.top, rect.height, bounds.height)
      progress.set(value)
      // Storytelling remains responsive while the manifest or first image loads.
      if (!manifest || !loader) return
      const index = progressFrame(value, manifest.frameCount)
      if (index !== wanted) {
        direction = wanted < 0 || index > wanted ? 1 : -1
        wanted = index
        surface!.dataset.wantedFrame = String(index + 1)
      }
      loader.configure(resourceOptions())
      loader.want(wanted, direction)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const resized = bounds.width !== lastWidth || bounds.height !== lastHeight || dpr !== lastDpr
      const target = loader.get(wanted)
      const image = target ?? (resized ? loader.get(painted) : undefined)
      if (image && (painted !== wanted || resized || surface!.dataset.ready !== 'true')) {
        try {
          if (paintFrame(surface!, image, bounds.width, bounds.height, background)) {
            // A cache miss during resize redraws the last image, never a blank surface.
            if (target) painted = wanted
            loader.pin(painted)
            lastWidth = bounds.width
            lastHeight = bounds.height
            lastDpr = dpr
            surface!.dataset.ready = 'true'
            surface!.dataset.paintedFrame = String(painted + 1)
            surface!.dataset.renderCount = String(++renders)
          }
        } catch {
          surface!.dataset.ready = 'false'
          onUnavailable()
        }
      }
      stats()
    }

    function schedule() {
      if (!disposed && near && !document.hidden && !raf) raf = requestAnimationFrame(update)
    }

    const intersection = new IntersectionObserver(([entry]) => {
      near = entry.isIntersecting
      if (near) schedule()
      else loader?.suspend()
    }, { rootMargin: '50% 0px' })
    intersection.observe(outer)
    const resize = new ResizeObserver(schedule)
    resize.observe(stage)
    resize.observe(outer)
    const visibility = () => {
      if (document.hidden) loader?.suspend()
      else schedule()
    }
    const contextLost = (event: Event) => {
      event.preventDefault()
      surface.dataset.ready = 'false'
    }
    surface.addEventListener('contextlost', contextLost)
    surface.addEventListener('contextrestored', schedule)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    window.addEventListener('pageshow', schedule)
    document.addEventListener('visibilitychange', visibility)

    void fetch(publicAsset(manifestPath), { signal: abort.signal }).then(async (response) => {
      if (!response.ok) throw new Error('Manifest unavailable')
      manifest = parseManifest(await response.json())
      if (disposed) return
      const options = resourceOptions()
      loader = new FrameLoader(manifest, options, (index, failed) => {
        if (disposed) return
        stats()
        if (failed && index === wanted && painted < 0) onUnavailable()
        else if (index === wanted) schedule()
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
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('pageshow', schedule)
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
  }, [section, viewport, canvas, progress, enabled, manifestPath, onUnavailable])
}
