import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Property } from '../../config/properties'
import { PropertyDetailsDialog } from '../properties/PropertyDetailsDialog'
import { ViewingRequestDialog } from '../contact/ViewingRequestDialog'
import { MobileMenu } from '../navigation/MobileMenu'

type Active = { kind: 'property'; property: Property } | { kind: 'viewing'; propertyId?: string } | { kind: 'menu' } | null
import { ExperienceContext } from './experience-context'
export function ExperienceProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const open = useCallback((next: Active, source?: HTMLElement) => {
    // Preserve the original card/CTA trigger across the detail → viewing transition.
    if (source) trigger.current = source
    setActive(next)
  }, [])
  const close = useCallback(() => {
    setActive(null)
    requestAnimationFrame(() => { if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true }) })
  }, [])
  const navigate = (href: string) => {
    setActive(null)
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(href)
      target?.scrollIntoView({ behavior: 'instant' }); target?.focus({ preventScroll: true })
      history.replaceState(null, '', href)
    })
  }
  return <ExperienceContext.Provider value={{ showProperty: (property, source) => open({ kind: 'property', property }, source), showViewing: (propertyId, source) => open({ kind: 'viewing', propertyId }, source), showMenu: source => open({ kind: 'menu' }, source) }}>
    {children}
    {active?.kind === 'property' && <PropertyDetailsDialog key="property" property={active.property} onClose={close} onViewing={() => open({ kind: 'viewing', propertyId: active.property.id })} />}
    {active?.kind === 'viewing' && <ViewingRequestDialog key="viewing" propertyId={active.propertyId} onClose={close} />}
    {active?.kind === 'menu' && <MobileMenu key="menu" onClose={close} onNavigate={navigate} />}
  </ExperienceContext.Provider>
}
