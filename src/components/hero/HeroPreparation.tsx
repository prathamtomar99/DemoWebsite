import { useState } from 'react'
import { motion } from 'motion/react'
import { HouseConstructionLoader } from './HouseConstructionLoader'
import type { PreparationProgress } from './full-frame-policy'
import { siteConfig } from '../../config/site'

export function HeroPreparation({ preparing, prepared }: { preparing: boolean; prepared: PreparationProgress }) {
  const [exited, setExited] = useState(false)
  if (!preparing && (!prepared.ready || exited)) return null
  return <motion.div className="hero-preparation" data-preparation="loading"
      initial={{ opacity: 1 }} animate={{ opacity: preparing ? 1 : 0 }} transition={{ duration: .16 }}
      aria-hidden={!preparing} inert={!preparing} onAnimationComplete={() => { if (!preparing) setExited(true) }}>
      <div className="hero-preparation-content">
        <p className="preparation-brand">{siteConfig.brandName}</p>
        <HouseConstructionLoader prepared={prepared} brandName={siteConfig.brandName} />
        <a className="preparation-skip" href="#after-hero">Continue without the film</a>
      </div>
    </motion.div>
}
