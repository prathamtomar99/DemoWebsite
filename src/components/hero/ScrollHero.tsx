import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useMotionValue } from 'motion/react'
import { ArrowUpRight } from 'lucide-react'
import { siteConfig } from '../../config/site'
import { publicAsset } from './manifest'
import { HeroPreparation } from './HeroPreparation'
import { useHeroPreparation } from './use-hero-preparation'
import { HeroStory } from './HeroStory'
import { useHeroMode } from './use-hero-mode'
import { useHeroSequence } from './use-hero-sequence'
import '../../styles/hero.css'

export function ScrollHero({ navigation }: { navigation?: ReactNode }) {
  const section = useRef<HTMLElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  // Latch the media profile for this page view: resizing changes layout/cache, never restarts the sequence.
  const [manifestPath] = useState(() => window.innerWidth < 768 ? siteConfig.hero.mobileManifestPath : siteConfig.hero.manifestPath)
  // Frames and storytelling share one deterministic progress value.
  const progress = useMotionValue(0)
  const mode = useHeroMode(section)
  // Lower-page entry stays a static, usable page without downloading the sequence.
  const [bypass] = useState(() => (!!location.hash && location.hash !== '#home') || !siteConfig.hero.preparation)
  const staticMode = mode.staticMode || bypass
  const fail = mode.fail
  const { preparing, prepared, report } = useHeroPreparation(staticMode)
  useHeroSequence({ section, viewport, canvas, progress, enabled: !staticMode, manifestPath, onUnavailable: fail, onPrepared: report })

  return (
    <section id="home" tabIndex={-1} ref={section} className="scroll-hero" data-static={staticMode} data-preparing={preparing} aria-labelledby="hero-heading" aria-describedby="hero-description">
      <div ref={viewport} className="hero-viewport">
        <img
          className="hero-poster" src={publicAsset(siteConfig.hero.posterPath)}
          width="960" height="540" alt="" fetchPriority="high" decoding="async"
          onError={(event) => { event.currentTarget.hidden = true }}
        />
        <canvas ref={canvas} className="hero-canvas" aria-hidden="true" />
        <div className="hero-overlay" inert={preparing}>
          <div className="hero-topline flex items-center justify-between">
            <a className="hero-brand" href="#home" aria-label={`${siteConfig.brandName}, home`}>{siteConfig.brandName}</a>
            <a className="hero-skip" href="#after-hero">{staticMode ? 'Continue' : 'Skip the film'}<ArrowUpRight aria-hidden="true" size={16} /></a>
            {navigation}
          </div>
          <p id="hero-description" className="sr-only">A cinematic view of a contemporary residence, from its landscaped exterior through the entrance into the living space.</p>
          <HeroStory progress={progress} staticMode={staticMode} revealed={!preparing} />
        </div>
        <HeroPreparation preparing={preparing} prepared={prepared} />
      </div>
    </section>
  )
}
