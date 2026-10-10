import type { Property } from '../../config/properties'
import { propertyDisclosure, imageryDisclosure } from '../../config/properties'
import { Modal } from '../shared/Modal'
import { PropertyImage } from '../shared/PropertyImage'
export function PropertyDetailsDialog({ property, onClose, onViewing }: { property: Property; onClose: () => void; onViewing: () => void }) {
  return <Modal titleId="property-dialog-title" className="property-dialog" onClose={onClose}>
    <div className="property-dialog-image"><PropertyImage property={property} detail /></div>
    <div className="property-dialog-copy"><p className="eyebrow">{property.category}</p><h2 id="property-dialog-title">{property.title}</h2>
      <p className="concept-label">{propertyDisclosure}</p><p>{property.story}</p>
      <button className="button-primary" onClick={onViewing}>Request a Viewing</button>
      <p className="small-copy">{imageryDisclosure}</p>
      <p className="photo-credit">Photography: <a href={property.source} target="_blank" rel="noreferrer">{property.photographer} / Unsplash<span className="sr-only"> (opens in a new tab)</span></a></p>
    </div>
  </Modal>
}
