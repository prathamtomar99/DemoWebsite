import { createContext, useContext } from 'react'
import type { Property } from '../../config/properties'
interface Actions { showProperty: (property: Property, trigger: HTMLElement) => void; showViewing: (propertyId: string | undefined, trigger: HTMLElement) => void; showMenu: (trigger: HTMLElement) => void }
export const ExperienceContext = createContext<Actions | null>(null)
export function useExperience() {
  const value = useContext(ExperienceContext)
  if (!value) throw new Error('Missing ExperienceProvider')
  return value
}
