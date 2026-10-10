import { properties, imageryDisclosure } from '../../config/properties'
import { PropertyCard } from './PropertyCard'
import { Reveal } from '../shared/Reveal'
export function FeaturedProperties() {
  return <section id="properties" tabIndex={-1} className="collection section-space page-container" aria-labelledby="handoff-heading">
    <Reveal className="section-introduction"><div><p className="eyebrow">The collection</p><h2 id="handoff-heading">Extraordinary places.<br />Exceptional living.</h2></div>
      <p className="section-description">A considered selection of residences defined by architecture, character, and timeless design.</p></Reveal>
    <div className="property-grid">{properties.map(property => <Reveal key={property.id}><PropertyCard property={property} /></Reveal>)}</div>
    <p className="collection-disclosure">{imageryDisclosure}</p>
  </section>
}
