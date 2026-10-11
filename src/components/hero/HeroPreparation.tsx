import { useState } from 'react'
import { motion } from 'motion/react'
import { preparationPercent } from './full-frame-policy'
import type { PreparationProgress } from './full-frame-policy'
import { siteConfig } from '../../config/site'

export function HeroPreparation({ preparing, prepared }: { preparing: boolean; prepared: PreparationProgress }) {
  const [exited, setExited] = useState(false)
  const percent = preparationPercent(prepared)
  if (!preparing && (!prepared.ready || exited)) return null
  return <motion.div className="hero-preparation" data-preparation="loading"
      initial={{ opacity: 1 }} animate={{ opacity: preparing ? 1 : 0 }} transition={{ duration: .16 }}
      aria-hidden={!preparing} inert={!preparing} onAnimationComplete={() => { if (!preparing) setExited(true) }}>
      <div className="hero-preparation-content">
        <p className="preparation-brand">{siteConfig.brandName}</p>
        <p role="status">Preparing your experience</p>
        <progress aria-label="Cinematic sequence preparation" max={100} value={percent} />
        <p className="preparation-percent">{percent}%</p>
        <p className="preparation-detail">{prepared.total ? `${prepared.downloaded}/${prepared.total} downloaded · ${prepared.decoded}/${prepared.total} decoded` : 'Reading frame manifest'}</p>
        <a className="preparation-skip" href="#after-hero">Continue without the film</a>
      </div>
    </motion.div>
}
