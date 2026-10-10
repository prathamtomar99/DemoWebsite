import { useRef, useState } from 'react'
import { Modal } from '../shared/Modal'
import { properties } from '../../config/properties'
import { localToday, validateViewing } from './viewing-validation'
import type { ViewingErrors, ViewingValues } from './viewing-validation'
const emptyValues: ViewingValues = { name: '', email: '', phone: '', property: '', date: '', message: '' }
export function ViewingRequestDialog({ propertyId, onClose }: { propertyId?: string; onClose: () => void }) {
  const [values, setValues] = useState<ViewingValues>({ ...emptyValues, property: propertyId ?? '' })
  const [errors, setErrors] = useState<ViewingErrors>({})
  const [complete, setComplete] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  const success = useRef<HTMLHeadingElement>(null)
  const field = (name: keyof ViewingValues) => ({ id: `viewing-${name}`, name, value: values[name], 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `error-${name}` : undefined,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValues(previous => ({ ...previous, [name]: event.target.value })) })
  const error = (name: keyof ViewingValues) => errors[name] && <p className="field-error" id={`error-${name}`}>{errors[name]}</p>
  return <Modal titleId="viewing-title" className="viewing-dialog" onClose={onClose}>
    {complete ? <div className="demo-success"><p className="eyebrow">A considered beginning</p><h2 id="viewing-title" ref={success} tabIndex={-1}>Demo complete.</h2><p role="status">Demo complete. No viewing request has been sent.</p><p>Your information has been cleared from this demonstration.</p><button className="button-primary" onClick={onClose}>Return to exploring</button></div> : <>
      <p className="eyebrow">A private introduction</p><h2 id="viewing-title">Request a viewing.</h2>
      <p className="demo-disclosure">Demo only. Your information will not be sent or stored.</p>
      <form ref={form} noValidate onSubmit={event => {
        event.preventDefault()
        const next = validateViewing(values, properties.map(p => p.id)); setErrors(next)
        const first = Object.keys(next)[0]
        if (first) { form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus(); return }
        setValues({ ...emptyValues }); setComplete(true)
        requestAnimationFrame(() => success.current?.focus())
      }}>
        <p className="small-copy">All fields required unless marked optional. The date is a preference, not a booking.</p>
        {Object.keys(errors).length > 0 && <p role="alert" className="field-error">Please check the highlighted fields.</p>}
        <div className="form-grid">
          <div className="field"><label htmlFor="viewing-name">Full name</label><input {...field('name')} autoComplete="name" required maxLength={120} />{error('name')}</div>
          <div className="field"><label htmlFor="viewing-email">Email</label><input {...field('email')} type="email" spellCheck={false} autoComplete="email" required maxLength={254} />{error('email')}</div>
          <div className="field"><label htmlFor="viewing-phone">Phone <span>(optional)</span></label><input {...field('phone')} type="tel" autoComplete="tel" maxLength={40} />{error('phone')}</div>
          <div className="field"><label htmlFor="viewing-property">Property of interest</label><select {...field('property')} required><option value="">Choose an interest</option><option value="general">General enquiry</option>{properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select>{error('property')}</div>
          <div className="field form-wide"><label htmlFor="viewing-date">Preferred viewing date</label><input {...field('date')} type="date" required min={localToday()} />{error('date')}</div>
          <div className="field form-wide"><label htmlFor="viewing-message">Message <span>(optional)</span></label><textarea {...field('message')} rows={3} maxLength={2000} />{error('message')}</div>
        </div>
        <button className="button-primary" type="submit">Complete demo request</button>
      </form>
    </>}
  </Modal>
}
