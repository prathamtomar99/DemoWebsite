import { Reveal } from '../shared/Reveal'
const services = [
  ['Curated Residences', 'A proposed collection shaped by architectural character, thoughtful spaces and a strong connection to place.'],
  ['Private Viewings', 'An intended personal introduction to each residence, with time to notice the details and imagine everyday life.'],
  ['Property Advisory', 'A concept for attentive conversations about your priorities, helping you explore what matters in your next home.'],
]
export function OurApproach() {
  return <section id="approach" tabIndex={-1} className="approach section-space page-container" aria-labelledby="approach-heading"><Reveal>
    <div className="approach-heading"><p className="eyebrow">Our approach</p><h2 id="approach-heading">Every detail considered.</h2><p className="small-copy">Three principles for a more personal property journey.<br />Proposed services for our concept agency.</p></div>
    <div className="service-list">{services.map(([title,description],index) => <article key={title}><span className="service-number" aria-hidden="true">0{index+1}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
  </Reveal></section>
}
