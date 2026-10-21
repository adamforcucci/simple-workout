import type { LoggedSet } from '../db/repos/workouts'

// Warm-ups are excluded from volume, PRs and set counts.
export const isWorkingSet = (s: LoggedSet) => s.type !== 'warmup'

export function setVolume(s: LoggedSet): number {
  return isWorkingSet(s) ? (s.weightKg ?? 0) * (s.reps ?? 0) : 0
}

export function totalVolume(sets: LoggedSet[]): number {
  return sets.reduce((sum, s) => sum + setVolume(s), 0)
}

// Epley estimate. Beyond ~12 reps the estimate is unreliable, so those sets
// don't produce one.
export function estimatedOneRepMax(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0 || reps > 12) return null
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30)
}

export function bestOneRepMax(sets: LoggedSet[]): number | null {
  let best: number | null = null
  for (const s of sets) {
    if (!isWorkingSet(s) || s.weightKg === null || s.reps === null) continue
    const e = estimatedOneRepMax(s.weightKg, s.reps)
    if (e !== null && (best === null || e > best)) best = e
  }
  return best
}

export function heaviestSet(sets: LoggedSet[]): LoggedSet | undefined {
  return sets
    .filter((s) => isWorkingSet(s) && s.weightKg !== null && (s.reps ?? 0) > 0)
    .sort((a, b) => b.weightKg! - a.weightKg! || b.reps! - a.reps!)[0]
}
