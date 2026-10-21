import type { LoggedSet } from '../../db/repos/workouts'
import type { Tracking } from '../../domain/exerciseCatalog'
import { toDisplayWeight, type WeightUnit } from '../../domain/units'
import { formatClock } from '../../lib/format'

export const SUPERSET_COLORS = ['border-sky-500', 'border-fuchsia-500', 'border-lime-500', 'border-amber-500']
export const REST_PRESETS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300]

export function formatPrevious(prev: LoggedSet | undefined, tracking: Tracking, unit: WeightUnit): string {
  if (!prev) return '–'
  if (tracking === 'duration') return prev.durationS ? formatClock(prev.durationS) : '–'
  const w = prev.weightKg ? `${toDisplayWeight(prev.weightKg, unit)}` : null
  if (tracking === 'reps') return w ? `+${w} × ${prev.reps ?? 0}` : `${prev.reps ?? '–'}`
  return w ? `${w} × ${prev.reps ?? 0}` : `${prev.reps ?? '–'}`
}
