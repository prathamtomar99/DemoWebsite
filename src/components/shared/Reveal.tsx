import { motion } from 'motion/react'
import { useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
const query = '(prefers-reduced-motion: reduce)'
const readPreference = () => window.matchMedia(query).matches
const subscribe = (update: () => void) => {
  const media = window.matchMedia(query)
  media.addEventListener('change', update)
  return () => media.removeEventListener('change', update)
}
export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduced = useSyncExternalStore(subscribe, readPreference, () => true)
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .08 }}
    animate={reduced ? { opacity: 1, y: 0 } : undefined}
    transition={{ duration: reduced ? 0 : .45, ease: [.22, 1, .36, 1] }}>{children}</motion.div>
}
