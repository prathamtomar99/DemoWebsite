import type { StoryStage } from '../../config/hero-story'

function ramp(value: number, start: number, end: number) {
  if (start === end) return value >= start ? 1 : 0
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)))
  return t * t * (3 - 2 * t)
}

/** Pure, reversible timeline. No elapsed time, springs, or frame-loading state. */
export function storyState(stage: StoryStage, progress: number) {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
  const [start, entered, exiting, end] = stage.range
  const enter = ramp(p, start, entered)
  const exit = stage.entrance === 'finale' ? 0 : ramp(p, exiting, end)
  const opacity = enter * (1 - exit)
  const direction = stage.alignment === 'right' ? 1 : -1
  return {
    opacity,
    x: stage.entrance === 'side' ? direction * (1 - enter + exit * .4) : 0,
    y: stage.entrance === 'intro' ? -exit * .6 : stage.entrance === 'finale' ? 1 - enter : -exit * .3,
  }
}
