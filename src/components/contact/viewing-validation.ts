export interface ViewingValues { name: string; email: string; phone: string; property: string; date: string; message: string }
export type ViewingErrors = Partial<Record<keyof ViewingValues, string>>
export function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
}
export function validateViewing(values: ViewingValues, propertyIds: readonly string[], today = localToday()): ViewingErrors {
  const errors: ViewingErrors = {}
  if (!values.name.trim()) errors.name = 'Please enter your full name.'
  if (!values.email.trim()) errors.email = 'Please enter your email address.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Please enter a valid email address.'
  if (!['general', ...propertyIds].includes(values.property)) errors.property = 'Please choose a property or a general enquiry.'
  if (!values.date) errors.date = 'Please choose a preferred date.'
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date) || !Number.isFinite(Date.parse(values.date)) || new Date(values.date).toISOString().slice(0,10)!==values.date || values.date < today) errors.date = 'Please choose today or a future date.'
  return errors
}
