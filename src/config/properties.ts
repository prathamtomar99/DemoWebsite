export interface Property {
  id: string
  title: string
  category: string
  description: string
  story: string
  image: string
  alt: string
  photographer: string
  source: string
}
export const properties: readonly Property[] = [
  { id: 'woodland', title: 'The Woodland Residence', category: 'Garden residence',
    description: 'A study in sheltered living, framed by mature trees and a generous garden.',
    story: 'This fictional residence concept explores the relationship between home and landscape. A leafy setting, a welcoming arrival and a calm material palette form its starting point — an invitation to imagine a slower rhythm of everyday living.',
    image: 'woodland', alt: 'A pale gabled home framed by mature trees and a green lawn', photographer: 'Ralph Florent', source: 'https://unsplash.com/photos/modern-suburban-house-with-a-green-lawn-and-trees-8raBQjkbTJA' },
  { id: 'horizon', title: 'The Horizon House', category: 'Modern coastal residence',
    description: 'Open terraces, luminous spaces and a lighter approach to indoor–outdoor living.',
    story: 'Conceived around light and openness, this demonstration concept imagines a home that flows naturally towards the outdoors. Clean horizontal lines, sheltered terraces and a restrained palette set the tone for an unhurried coastal way of life.',
    image: 'horizon', alt: 'White modern architecture and a shaded terrace beside a sunlit swimming pool', photographer: 'John Fornander', source: 'https://unsplash.com/photos/white-concrete-building-with-swimming-pool-y3_AHHrxUBY' },
  { id: 'courtyard', title: 'The Courtyard Estate', category: 'Architectural family home',
    description: 'Sculptural lines and green outlooks inspire a considered setting for life together.',
    story: 'An architectural family-home concept shaped around connection and retreat. Generous openings and garden-facing spaces inspire a balance between shared moments and personal space. Its name and narrative are fictional; the photograph is an independent architectural reference.',
    image: 'courtyard', alt: 'A white contemporary home with broad balconies surrounded by palms', photographer: 'Jeffrey Eisen', source: 'https://unsplash.com/photos/a-large-white-modern-house-with-palm-trees-HL3UvV8MJwU' },
]
export const propertyDisclosure = 'Concept property · Not a market listing'
export const imageryDisclosure = 'Illustrative photography. These fictional concepts are not properties represented by this fictional agency.'
