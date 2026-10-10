import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

type Connection = EventTarget & { saveData?: boolean }
const connection = () => (navigator as Navigator & { connection?: Connection }).connection
const prefersStatic = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
  window.matchMedia('(prefers-reduced-data: reduce)').matches || Boolean(connection()?.saveData)

function capturePosition(section: RefObject<HTMLElement | null>) {
  const element = section.current
  return element ? { top: element.getBoundingClientRect().top + window.scrollY, height: element.offsetHeight, y: window.scrollY } : null
}

export function useHeroMode(section: RefObject<HTMLElement | null>) {
  const [staticMode, setStaticMode] = useState(prefersStatic)
  const failed = useRef(false)
  const snapshot = useRef<{ top: number; height: number; y: number } | null>(null)
  const change = useCallback((next: boolean) => {
    snapshot.current = capturePosition(section)
    setStaticMode(next)
  }, [section])
  const fail = useCallback(() => {
    failed.current = true
    change(true)
  }, [change])

  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const data = matchMedia('(prefers-reduced-data: reduce)')
    const network = connection()
    const update = () => change(failed.current || prefersStatic())
    motion.addEventListener('change', update)
    data.addEventListener('change', update)
    network?.addEventListener('change', update)
    return () => {
      motion.removeEventListener('change', update)
      data.removeEventListener('change', update)
      network?.removeEventListener('change', update)
    }
  }, [change])

  useLayoutEffect(() => {
    const before = snapshot.current
    snapshot.current = null
    const element = section.current
    if (!before || !element) return
    // Preserve the logical reading location when a live preference releases the pin.
    if (before.y >= before.top + before.height) {
      window.scrollTo(0, before.y + element.offsetHeight - before.height)
    } else if (staticMode && before.y > before.top) {
      window.scrollTo(0, before.top)
    }
  }, [staticMode, section])

  return { staticMode, fail }
}
