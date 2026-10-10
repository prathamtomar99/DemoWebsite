import type { Property } from '../../config/properties'
export function PropertyImage({ property, detail = false }: { property: Property; detail?: boolean }) {
  return <img src={`${import.meta.env.BASE_URL}images/${property.image}-800.webp`}
    srcSet={[480,800,1200].map(w => `${import.meta.env.BASE_URL}images/${property.image}-${w}.webp ${w}w`).join(', ')}
    sizes={detail ? '(min-width: 768px) 480px, 90vw' : '(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 90vw'}
    width={800} height={1000} alt={property.alt} loading={detail ? 'eager' : 'lazy'} decoding="async" />
}
