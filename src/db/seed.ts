import { buildCatalog } from '../domain/exerciseCatalog'
import type { Db } from './types'

// Inserts any built-in exercises not already present. Safe to run on every
// start, so new Strava exercise IDs get picked up without a migration.
export async function seedExercises(db: Db): Promise<number> {
  const existing = new Set(
    (await db.all<{ strava_exercise_type: string }>('SELECT strava_exercise_type FROM exercises WHERE is_custom = 0')).map(
      (r) => r.strava_exercise_type,
    ),
  )
  const missing = buildCatalog().filter((e) => !existing.has(e.stravaExerciseType))
  if (missing.length === 0) return 0

  await db.batch(
    `INSERT INTO exercises
       (name, strava_exercise_type, category, primary_muscles, secondary_muscles, equipment, tracking, default_rest_s)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    missing.map((e) => [
      e.name,
      e.stravaExerciseType,
      e.category,
      e.primaryMuscles.join(','),
      e.secondaryMuscles.join(','),
      e.equipment,
      e.tracking,
      e.defaultRestS,
    ]),
  )
  return missing.length
}
