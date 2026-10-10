import { Reveal } from '../shared/Reveal'
import { useExperience } from '../shared/experience-context'
export function ClosingCTA() {
  const { showViewing } = useExperience()
  return <section id="contact" tabIndex={-1} className="closing section-space" aria-labelledby="closing-heading"><span id="enquire" />
    <Reveal className="page-container closing-inner"><p className="eyebrow">Your next chapter</p><h2 id="closing-heading">Find a place worth<br />calling extraordinary.</h2><p>Begin exploring considered spaces and a more personal approach to property discovery.</p>
      <div className="closing-actions"><button className="button-primary button-light" onClick={event => showViewing(undefined, event.currentTarget)}>Request a Private Viewing</button><a className="text-action" href="#properties">Explore Properties <span aria-hidden="true">↗</span></a></div><p className="small-copy">A demonstration experience. No appointments are booked.</p>
    </Reveal>
  </section>
}
