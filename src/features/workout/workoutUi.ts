import type { LoggedSet } from '../../db/repos/workouts'
import type { ActiveWorkout } from '../../store/activeWorkout'
import type { Tracking } from '../../domain/exerciseCatalog'
import { toDisplayWeight, type WeightUnit } from '../../domain/units'
import { formatClock } from '../../lib/format'

// What the reference column of a set row shows.
export type ReferenceMode = 'previous' | 'best'

export const SUPERSET_COLORS = ['border-sky-500', 'border-fuchsia-500', 'border-lime-500', 'border-amber-500']
export const REST_PRESETS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300]

export function formatPrevious(prev: LoggedSet | undefined, tracking: Tracking, unit: WeightUnit): string {
  if (!prev) return '–'
  if (tracking === 'duration') return prev.durationS ? formatClock(prev.durationS) : '–'
  const w = prev.weightKg ? `${toDisplayWeight(prev.weightKg, unit)}` : null
  if (tracking === 'reps') return w ? `+${w} × ${prev.reps ?? 0}` : `${prev.reps ?? '–'}`
  return w ? `${w} × ${prev.reps ?? 0}` : `${prev.reps ?? '–'}`
}

// The next set still to do, in workout order, for the "Next" line. Numbered
// the way the set rows are: warm-ups are "W", working sets count from 1.
export function nextUp(w: Pick<ActiveWorkout, 'exercises'> | null): string | null {
  for (const e of w?.exercises ?? []) {
    const i = e.sets.findIndex((s) => s.completedAt === null)
    if (i < 0) continue
    if (e.sets[i].type === 'warmup') return `${e.name} · warm-up`
    const n = e.sets.slice(0, i + 1).filter((s) => s.type !== 'warmup').length
    return `${e.name} · set ${n}`
  }
  return null
}
