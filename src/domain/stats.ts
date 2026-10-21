import { addWeeks, format, startOfWeek } from 'date-fns'
import type { WorkoutSummary } from '../db/repos/workouts'
import type { Muscle } from './exerciseCatalog'
import { estimatedOneRepMax } from './sets'

const WEEK = { weekStartsOn: 1 } as const

export interface WeekBucket {
  weekStart: number
  label: string
  workouts: number
  volumeKg: number
  durationS: number
}

// The last `weeks` calendar weeks (Mon–Sun) ending with the current one.
export function weeklySeries(workouts: WorkoutSummary[], weeks: number, now = Date.now()): WeekBucket[] {
  const first = addWeeks(startOfWeek(now, WEEK), -(weeks - 1))
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, i) => {
    const start = addWeeks(first, i)
    return { weekStart: start.getTime(), label: format(start, 'd MMM'), workouts: 0, volumeKg: 0, durationS: 0 }
  })
  for (const w of workouts) {
    const i = buckets.findLastIndex((b) => w.startedAt >= b.weekStart)
    if (i < 0) continue
    buckets[i].workouts++
    buckets[i].volumeKg += w.volumeKg
    buckets[i].durationS += ((w.endedAt ?? w.startedAt) - w.startedAt) / 1000
  }
  return buckets
}

// Consecutive weeks with at least one workout, counting back from this week
// (or from last week, if nothing has been logged yet this week).
export function weekStreak(workouts: WorkoutSummary[], now = Date.now()): number {
  const weeks = new Set(workouts.map((w) => startOfWeek(w.startedAt, WEEK).getTime()))
  let cursor = startOfWeek(now, WEEK)
  if (!weeks.has(cursor.getTime())) cursor = addWeeks(cursor, -1)
  let streak = 0
  while (weeks.has(cursor.getTime())) {
    streak++
    cursor = addWeeks(cursor, -1)
  }
  return streak
}

export interface SetRecord {
  workoutId: number
  startedAt: number
  exerciseId: number
  exerciseName: string
  primaryMuscles: Muscle[]
  weightKg: number | null
  reps: number | null
}

// Working sets per primary muscle, most-trained first.
export function muscleSplit(sets: SetRecord[]): { muscle: Muscle; sets: number }[] {
  const counts = new Map<Muscle, number>()
  for (const s of sets) for (const m of s.primaryMuscles) counts.set(m, (counts.get(m) ?? 0) + 1)
  return [...counts].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets)
}

export interface BestLift {
  exerciseId: number
  name: string
  oneRepMax: number
  weightKg: number
  reps: number
  startedAt: number
}

// Each loaded exercise's best estimated 1RM, strongest first.
export function bestLifts(sets: SetRecord[]): BestLift[] {
  const best = new Map<number, BestLift>()
  for (const s of sets) {
    if (!s.weightKg || !s.reps) continue
    const e1rm = estimatedOneRepMax(s.weightKg, s.reps)
    if (e1rm === null) continue
    const cur = best.get(s.exerciseId)
    if (!cur || e1rm > cur.oneRepMax)
      best.set(s.exerciseId, {
        exerciseId: s.exerciseId,
        name: s.exerciseName,
        oneRepMax: e1rm,
        weightKg: s.weightKg,
        reps: s.reps,
        startedAt: s.startedAt,
      })
  }
  return [...best.values()].sort((a, b) => b.oneRepMax - a.oneRepMax)
}
