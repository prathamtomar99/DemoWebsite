import { useEffect } from 'react'

/** Recover fragment navigation when the browser looked for the anchor before React mounted. */
export function useSectionAnchor() {
  useEffect(() => {
    let pending = 0
    const restore = () => {
      cancelAnimationFrame(pending)
      pending = requestAnimationFrame(() => {
        // Give native history restoration precedence, including positions inside the film.
        if (window.scrollY !== 0 || !window.location.hash) return
        let id: string
        try { id = decodeURIComponent(window.location.hash.slice(1)) } catch { return }
        const target = document.getElementById(id)
        if (!target || target.getBoundingClientRect().top < window.innerHeight) return
        target.scrollIntoView({ behavior: 'instant', block: 'start' })
        target.focus({ preventScroll: true })
      })
    }
    restore()
    window.addEventListener('pageshow', restore)
    window.addEventListener('hashchange', restore)
    return () => {
      cancelAnimationFrame(pending)
      window.removeEventListener('pageshow', restore)
      window.removeEventListener('hashchange', restore)
    }
  }, [])
}
