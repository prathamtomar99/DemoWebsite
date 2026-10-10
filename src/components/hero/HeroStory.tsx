import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { ArrowUpRight } from 'lucide-react'
import { heroStory, introEntrance, storyEase } from '../../config/hero-story'
import type { StoryStage } from '../../config/hero-story'
import { storyState } from './story-timeline'

interface StageProps {
  stage: StoryStage
  progress: MotionValue<number>
  focused: MotionValue<string>
  staticMode: boolean
}

function StoryPanel({ stage, progress, focused, staticMode }: StageProps) {
  const panel = useRef<HTMLDivElement>(null)
  const isIntro = stage.entrance === 'intro'
  const [entered, setEntered] = useState(staticMode || !isIntro)
  const state = useTransform(() => {
    const held = focused.get()
    const p = progress.get()
    if (staticMode) return { opacity: isIntro ? 1 : 0, x: 0, y: 0 }
    if (held) return { opacity: held === stage.id ? 1 : 0, x: 0, y: 0 }
    return storyState(stage, p)
  })
  const opacity = useTransform(() => state.get().opacity)
  const transform = useTransform(() => {
    const { x, y } = state.get()
    return `translate3d(calc(var(--story-x) * ${x}), calc(var(--story-y) * ${y}), 0)`
  })

  useEffect(() => {
    const node = panel.current
    if (!node) return
    const sync = (alpha: number) => {
      const visible = alpha > .001
      if (!visible && node.contains(document.activeElement)) {
        // Only a live static-mode switch overrides the focused-panel hold.
        // Move to the persistent, visible bypass link before making this panel inert.
        node.closest('.hero-overlay')?.querySelector<HTMLAnchorElement>('.hero-skip')?.focus({ preventScroll: true })
      }
      if (node.dataset.active !== String(visible)) {
        node.inert = !visible
        node.setAttribute('aria-hidden', String(!visible))
        node.dataset.active = String(visible)
        node.style.visibility = visible ? 'visible' : 'hidden'
      }
      const link = node.querySelector('a')
      if (link) {
        // During the mount entrance or a near-transparent transition, skip the CTA.
        const interactive = visible && alpha >= .5 && (entered || staticMode)
        if (link.dataset.interactive !== String(interactive)) {
          link.dataset.interactive = String(interactive)
          link.tabIndex = interactive ? 0 : -1
          link.style.pointerEvents = interactive ? 'auto' : 'none'
        }
      }
    }
    sync(opacity.get())
    return opacity.on('change', sync)
  }, [opacity, entered, staticMode])

  const entrance = (part: keyof typeof introEntrance) => {
    const { y, duration, delay } = introEntrance[part]
    return {
      initial: staticMode || !isIntro ? false as const : { opacity: 0, y: `calc(var(--intro-travel) * ${y})` },
      animate: { opacity: 1, y: 0 },
      transition: { duration: staticMode || !isIntro ? 0 : duration, delay: staticMode || !isIntro ? 0 : delay, ease: storyEase },
    }
  }
  const Heading = isIntro ? motion.h1 : motion.h2
  return (
    <motion.div ref={panel} className={`hero-story-stage story-${stage.id} story-align-${stage.alignment}`}
      data-story={stage.id} style={{ opacity, transform }}
      onFocusCapture={() => focused.set(stage.id)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) focused.set('') }}>
      <div className="story-heading-group">
        <motion.p className="hero-eyebrow" {...entrance('eyebrow')}>{stage.eyebrow}</motion.p>
        <Heading id={isIntro ? 'hero-heading' : undefined} {...entrance('headline')}>{stage.headline}</Heading>
      </div>
      <div className="story-detail-group">
        {stage.description && <motion.p className="story-description" {...entrance('description')}>{stage.description}</motion.p>}
        {stage.cta && <motion.div className="story-cta-wrap" {...entrance('cta')} onAnimationComplete={() => setEntered(true)}>
          <a className="story-cta" href={stage.cta.href} tabIndex={-1}>{stage.cta.label}<ArrowUpRight size={17} aria-hidden="true" /></a>
        </motion.div>}
      </div>
    </motion.div>
  )
}

export function HeroStory({ progress, staticMode }: { progress: MotionValue<number>; staticMode: boolean }) {
  // Hold a focused outgoing CTA visibly until focus leaves; suppress other panels.
  const focused = useMotionValue('')
  return <div className="hero-story">
    {heroStory.map(stage => <StoryPanel key={stage.id} stage={stage} progress={progress} focused={focused} staticMode={staticMode} />)}
  </div>
}
