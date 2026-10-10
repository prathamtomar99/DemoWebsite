import { ScrollHero } from '../components/hero/ScrollHero'
import { SiteNavigation, SectionNavigation } from '../components/navigation/SiteNavigation'
import { FeaturedProperties } from '../components/properties/FeaturedProperties'
import { AgencyIntroduction } from '../components/agency/AgencyIntroduction'
import { OurApproach } from '../components/agency/OurApproach'
import { ClosingCTA } from '../components/contact/ClosingCTA'
import { Footer } from '../components/layout/Footer'
import { ExperienceProvider } from '../components/shared/ExperienceProvider'
import { useSectionAnchor } from '../hooks/use-section-anchor'
import '../styles/website.css'
export function HomePage() {
  useSectionAnchor()
  return <ExperienceProvider><main>
    <ScrollHero navigation={<SectionNavigation cinema />} />
    <div id="after-hero" tabIndex={-1} aria-labelledby="handoff-heading">
      <SiteNavigation /><FeaturedProperties /><AgencyIntroduction /><OurApproach /><ClosingCTA />
    </div>
  </main><Footer /></ExperienceProvider>
}
