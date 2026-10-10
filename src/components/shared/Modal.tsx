import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
export function Modal({ children, titleId, onClose, className = '' }: { children: ReactNode; titleId: string; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    dialog.showModal()
    return () => { dialog.close(); root.style.overflow = previous }
  }, [])
  return <dialog ref={ref} className={`site-dialog ${className}`} aria-labelledby={titleId}
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')]
        .filter(node => node.tabIndex >= 0 && !node.hasAttribute('disabled') && node.getClientRects().length > 0)
      // WebKit's default keyboard preference skips implicit button/link tab stops.
      // Explicit zero keeps the whole dialog operable without overriding native date-field traversal.
      controls.forEach(node => { if (!node.hasAttribute('tabindex')) node.tabIndex = 0 })
      const first = controls[0]
      const last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}
    onCancel={event => { event.preventDefault(); onClose() }}>
    <button type="button" className="dialog-close" onClick={onClose} aria-label="Close dialog"><X size={22} aria-hidden="true" /></button>
    {children}
  </dialog>
}
