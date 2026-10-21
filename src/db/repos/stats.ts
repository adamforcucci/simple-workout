import type { Muscle } from '../../domain/exerciseCatalog'
import type { SetRecord } from '../../domain/stats'
import type { Db } from '../types'

// Working (non-warm-up) sets from finished workouts started at or after `from`.
export async function workingSets(db: Db, from = 0): Promise<SetRecord[]> {
  const rows = await db.all<{
    workout_id: number
    started_at: number
    exercise_id: number
    name: string
    primary_muscles: string
    weight_kg: number | null
    reps: number | null
  }>(
    `SELECT w.id AS workout_id, w.started_at, e.id AS exercise_id, e.name, e.primary_muscles, s.weight_kg, s.reps
     FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     JOIN exercises e ON e.id = we.exercise_id
     WHERE w.ended_at IS NOT NULL AND w.started_at >= ? AND s.type != 'warmup'`,
    [from],
  )
  return rows.map((r) => ({
    workoutId: r.workout_id,
    startedAt: r.started_at,
    exerciseId: r.exercise_id,
    exerciseName: r.name,
    primaryMuscles: (r.primary_muscles ? r.primary_muscles.split(',') : []) as Muscle[],
    weightKg: r.weight_kg,
    reps: r.reps,
  }))
}
