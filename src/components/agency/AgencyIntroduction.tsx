import { siteConfig } from '../../config/site'
import { Reveal } from '../shared/Reveal'
export function AgencyIntroduction() {
  return <section id="about" tabIndex={-1} className="agency section-space" aria-labelledby="agency-heading"><Reveal className="page-container agency-grid">
    <div className="agency-copy"><p className="eyebrow">Our philosophy</p><h2 id="agency-heading">A different perspective on extraordinary homes.</h2>
      <p>At {siteConfig.brandName}, we believe remarkable spaces deserve an equally considered presentation. Our concept brings architecture, atmosphere, and thoughtful discovery together.</p>
      <p className="small-copy">An independent vision of how finding a home could feel. A fictional agency, created to explore the possibilities.</p>
      <a className="text-action" href="#approach">Discover our approach <span aria-hidden="true">↗</span></a>
    </div><figure className="agency-image"><img src={`${import.meta.env.BASE_URL}images/agency-interior.jpg`} width={1280} height={720} loading="lazy" decoding="async" alt="The supplied cinematic residence: a double-height interior with warm materials and generous glazing" /><figcaption>Light. Space. A sense of possibility.<span>Source residence · Concept imagery</span></figcaption></figure>
  </Reveal></section>
}
