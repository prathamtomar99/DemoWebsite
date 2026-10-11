export interface BlendOptions {
  enabled: boolean
  start: number
  end: number
  curve: 'smoothstep' | 'linear'
}

/** Pure scroll mapping: no direction, clock, or previous-frame dependence. */
export function frameBlend(progress: number, count: number, options: BlendOptions) {
  const position = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)) * Math.max(0, count - 1)
  const nearest = Math.round(position)
  // At the first/last composition, only that exact image may replace the poster.
  if (!options.enabled || position === 0 || position === count - 1) return { current: nearest, next: nearest, alpha: 0, nearest }
  const current = Math.floor(position)
  const next = Math.min(current + 1, count - 1)
  const fraction = position - current
  const t = Math.max(0, Math.min(1, (fraction - options.start) / (options.end - options.start)))
  const alpha = options.curve === 'smoothstep' ? t * t * (3 - 2 * t) : t
  return { current, next, alpha, nearest }
}

/** Missing images can only fall back to this exact pair, never blend distant frames. */
export function availableBlend(sample: ReturnType<typeof frameBlend>, current: boolean, next: boolean) {
  if (current && next && sample.current !== sample.next && sample.alpha > 0 && sample.alpha < 1) {
    return { base: sample.current, overlay: sample.next, alpha: sample.alpha, dominant: sample.nearest }
  }
  const index = current && (!next || sample.alpha < 0.5) ? sample.current : next ? sample.next : -1
  return index < 0 ? undefined : { base: index, overlay: -1, alpha: 0, dominant: index }
}
