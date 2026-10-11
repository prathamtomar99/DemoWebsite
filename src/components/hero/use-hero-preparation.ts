import { useCallback, useEffect, useState } from 'react'
import type { MotionValue } from 'motion/react'
import { siteConfig } from '../../config/site'

export function useHeroPreparation(staticMode: boolean, progress: MotionValue<number>) {
  const [pending, setPending] = useState(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    return siteConfig.hero.preparation && !staticMode && !location.hash && window.scrollY === 0 &&
      (!navigation || navigation.type === 'navigate')
  })
  const [prepared, setPrepared] = useState(0)
  const dismiss = useCallback(() => setPending(false), [])
  const report = useCallback((count: number) => {
    setPrepared(count)
    if (count >= 3) setPending(false)
  }, [])
  // A live accessibility preference permanently ends this mount's preparation.
  if (pending && staticMode) setPending(false)
  useEffect(() => {
    if (!pending || staticMode) return
    const timeout = setTimeout(dismiss, 2500)
    const unsubscribe = progress.on('change', value => { if (value > 0) dismiss() })
    // Never cover a focused control or interfere with user intent/scroll restoration.
    const events = ['pointerdown', 'keydown', 'focusin', 'hashchange', 'pagehide'] as const
    for (const event of events) window.addEventListener(event, dismiss, { capture: true, once: true })
    return () => {
      clearTimeout(timeout)
      unsubscribe()
      for (const event of events) window.removeEventListener(event, dismiss, true)
    }
  }, [pending, staticMode, progress, dismiss])
  return { preparing: pending && !staticMode, prepared, report }
}
