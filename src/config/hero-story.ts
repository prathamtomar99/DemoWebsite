import { siteConfig } from './site'

export interface StoryStage {
  id: string
  alignment: 'left' | 'right' | 'center'
  eyebrow: string
  headline: string
  description?: string
  cta?: { label: string; href: string }
  /** Enter start/end, exit start/end. The finale holds through release. */
  range: readonly [number, number, number, number]
  entrance: 'intro' | 'side' | 'finale'
}

export const heroStory: readonly StoryStage[] = [
  { id: 'intro', alignment: 'left', eyebrow: siteConfig.brandName, headline: 'Beyond the expected.',
    description: 'Explore exceptional architecture and discover a more considered vision of modern living.',
    cta: { label: 'Explore Properties', href: '#properties' }, range: [0, 0, .04, .14], entrance: 'intro' },
  { id: 'right', alignment: 'right', eyebrow: 'Architectural distinction', headline: 'Every perspective reveals something extraordinary.',
    range: [.18, .24, .43, .50], entrance: 'side' },
  { id: 'left', alignment: 'left', eyebrow: 'Designed to inspire', headline: 'Step inside a world of considered living.',
    range: [.54, .61, .80, .87], entrance: 'side' },
  { id: 'finale', alignment: 'center', eyebrow: `Discover ${siteConfig.brandName}`, headline: 'Where extraordinary living begins.',
    cta: { label: 'Explore Our Collection', href: '#properties' }, range: [.88, .96, 1, 1], entrance: 'finale' },
]

export const introEntrance = {
  eyebrow: { y: 28, duration: 1, delay: .05 },
  headline: { y: 56, duration: 1.3, delay: .2 },
  description: { y: 36, duration: 1.1, delay: .4 },
  cta: { y: 28, duration: 1, delay: .55 },
} as const
export const storyEase = [.16, 1, .3, 1] as const
