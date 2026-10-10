import { ArrowUpRight } from 'lucide-react'
import { propertyDisclosure } from '../../config/properties'
import type { Property } from '../../config/properties'
import { PropertyImage } from '../shared/PropertyImage'
import { useExperience } from '../shared/experience-context'
export function PropertyCard({ property }: { property: Property }) {
  const { showProperty } = useExperience()
  return <article className="property-card">
    <div className="property-image"><PropertyImage property={property} /></div>
    <p className="property-category">{property.category}</p>
    <h3>{property.title}</h3><p className="property-description">{property.description}</p>
    <p className="concept-label">{propertyDisclosure}</p>
    <button className="text-action" onClick={event => showProperty(property, event.currentTarget)} aria-label={`Explore Residence: ${property.title}`}>Explore Residence<ArrowUpRight size={18} aria-hidden="true" /></button>
  </article>
}
