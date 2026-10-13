import { preparationPercent } from './full-frame-policy'
import type { PreparationProgress } from './full-frame-policy'

const stages = [
  { start: 0, end: 15, label: 'Preparing the site' },
  { start: 15, end: 30, label: 'Laying the groundwork' },
  { start: 30, end: 50, label: 'Building the foundation' },
  { start: 50, end: 70, label: 'Raising the structure' },
  { start: 70, end: 85, label: 'Shaping the residence' },
  { start: 85, end: 100, label: 'Finishing the details' },
]

/** Normalized SVG strokes follow preparation, with no animation clock or simulated progress. */
function Linework({ d, progress }: { d: string; progress: number }) {
  return <path className="construction-line" d={d} pathLength={1}
    style={{ strokeDasharray: 1, strokeDashoffset: 1 - progress, opacity: progress > 0 ? 1 : 0 }} />
}

export function HouseConstructionLoader({ prepared, brandName }: { prepared: PreparationProgress; brandName: string }) {
  // The existing adapter withholds 100 until every bitmap is retained AND Canvas has drawn.
  const percent = preparationPercent(prepared)
  const complete = percent === 100
  const stage = stages.findLastIndex(({ start }) => percent >= start)
  const [plot, ground, foundation, walls, roof, details] = stages.map(({ start, end }) =>
    Math.max(0, Math.min(1, (percent - start) / (end - start))))

  return <>
    <svg className="house-construction" viewBox="0 0 320 230" width="320" height="230"
      aria-hidden="true" focusable="false" data-stage={stage + 1} data-complete={complete}>
      <g className="construction-guides" style={{ opacity: plot * .28 }}>
        <path d="M31 180H289 M52 196V152 M262 164V120 M34 189L82 153 M244 193L287 160" />
      </g>
      <g className="construction-bronze construction-move" style={{ transform: `translateY(${-12 * (1 - ground)}px)` }}>
        <Linework d="M42 181L77 155H272L237 181Z" progress={plot} />
      </g>
      <g className="construction-bronze">
        <Linework d="M25 190H251L291 160" progress={ground} />
        <Linework d="M42 181V187H237L272 161V155 M237 181V187 M51 183L65 173 M70 183L84 173" progress={ground} />
      </g>
      <g className="construction-bronze construction-move" style={{ opacity: foundation, transform: `translateY(${4 * (1 - foundation)}px)` }}>
        <path className="construction-slab" d="M57 174L89 150H254V158L222 182H57Z" />
        <Linework d="M57 174H222L254 150 M222 174V182 M57 174L89 150H254" progress={foundation} />
      </g>
      <g className="construction-walls construction-move" style={{ opacity: walls, transform: `scaleY(${.05 + .95 * walls})` }}>
        <path className="construction-side" d="M222 102L254 78V150L222 174Z" />
        <path className="construction-facade" fillRule="evenodd"
          d="M65 102H222V174H65Z M82 119V153H139V119Z M159 115V174H192V115Z" />
        <Linework d="M65 174V102H222V174 M222 102L254 78V150 M65 102L97 78H254" progress={walls} />
      </g>
      <g>
        <Linework d="M58 98L93 72H263L228 98Z M58 98V103H228L263 77V72 M228 98V103" progress={roof} />
        <Linework d="M82 119H139V153H82Z M159 174V115H192V174 M234 108L244 100V129L234 137Z" progress={roof} />
      </g>
      <g className="construction-bronze">
        <Linework d="M110 119V153 M82 142H139 M163 174V119H188V174 M183 147V153" progress={details} />
        <Linework d="M159 182L142 199H177L194 182 M151 190H186" progress={details} />
        <Linework d="M274 167V144 M274 156C265 156 262 151 263 147C270 146 274 150 274 156 M274 151C274 144 278 140 283 140C284 147 280 151 274 151" progress={details} />
      </g>
      <path className="construction-ready" d="M65 174H139" pathLength={1}
        style={{ opacity: complete ? 1 : 0 }} />
    </svg>
    <p className="preparation-status" role="status" aria-live="polite" aria-atomic="true">
      {complete ? `Welcome to ${brandName}` : stages[stage].label}
    </p>
  </>
}
