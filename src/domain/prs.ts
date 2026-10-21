import type { ExerciseSession, LoggedSet } from '../db/repos/workouts'
import { bestOneRepMax, heaviestSet, isWorkingSet } from './sets'

export type PrKind = 'weight' | 'oneRepMax' | 'reps'

export interface PersonalRecord {
  kind: PrKind
  value: number
}

function maxReps(sets: LoggedSet[]): number | null {
  const reps = sets.filter(isWorkingSet).map((s) => s.reps ?? 0)
  return reps.length ? Math.max(...reps) : null
}

// Records set in `current` compared with all earlier sessions. Nothing counts
// as a PR on the first ever session of an exercise.
export function findPrs(history: ExerciseSession[], current: LoggedSet[]): PersonalRecord[] {
  const before = history.flatMap((s) => s.sets)
  if (before.filter(isWorkingSet).length === 0) return []
  const prs: PersonalRecord[] = []

  const curHeavy = heaviestSet(current)?.weightKg
  const prevHeavy = heaviestSet(before)?.weightKg
  if (curHeavy != null && prevHeavy != null && curHeavy > prevHeavy) prs.push({ kind: 'weight', value: curHeavy })

  const cur1rm = bestOneRepMax(current)
  const prev1rm = bestOneRepMax(before)
  if (cur1rm !== null && prev1rm !== null && cur1rm > prev1rm + 1e-9) prs.push({ kind: 'oneRepMax', value: cur1rm })

  // Rep PRs only matter for unloaded exercises.
  const unloaded = (sets: LoggedSet[]) => sets.every((s) => !s.weightKg)
  if (unloaded(current) && unloaded(before)) {
    const cur = maxReps(current)
    const prev = maxReps(before)
    if (cur !== null && prev !== null && cur > prev) prs.push({ kind: 'reps', value: cur })
  }
  return prs
}
