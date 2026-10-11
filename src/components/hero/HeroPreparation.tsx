import { AnimatePresence, motion } from 'motion/react'
import { siteConfig } from '../../config/site'

export function HeroPreparation({ preparing, prepared }: { preparing: boolean; prepared: number }) {
  return <AnimatePresence>
    {preparing && <motion.div className="hero-preparation" data-preparation="loading"
      initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .16 }}>
      <div className="hero-preparation-content">
        <p className="preparation-brand">{siteConfig.brandName}</p>
        <p role="status">Preparing your experience</p>
        <progress aria-label="Initial cinematic frames prepared" max={3} value={prepared} />
      </div>
    </motion.div>}
  </AnimatePresence>
}
