import type { Equipment, Muscle, Tracking } from '../../domain/exerciseCatalog'
import type { Db, SqlValue } from '../types'

export interface Exercise {
  id: number
  name: string
  stravaExerciseType: string
  category: string
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  equipment: Equipment
  tracking: Tracking
  defaultRestS: number
  isCustom: boolean
  archived: boolean
}

export type ExerciseInput = Omit<Exercise, 'id' | 'isCustom' | 'archived'>

interface ExerciseRow {
  id: number
  name: string
  strava_exercise_type: string
  category: string
  primary_muscles: string
  secondary_muscles: string
  equipment: Equipment
  tracking: Tracking
  default_rest_s: number
  is_custom: number
  archived: number
}

const splitMuscles = (s: string) => (s ? (s.split(',') as Muscle[]) : [])

function toExercise(r: ExerciseRow): Exercise {
  return {
    id: r.id,
    name: r.name,
    stravaExerciseType: r.strava_exercise_type,
    category: r.category,
    primaryMuscles: splitMuscles(r.primary_muscles),
    secondaryMuscles: splitMuscles(r.secondary_muscles),
    equipment: r.equipment,
    tracking: r.tracking,
    defaultRestS: r.default_rest_s,
    isCustom: r.is_custom === 1,
    archived: r.archived === 1,
  }
}

export interface ExerciseFilter {
  query?: string
  muscle?: Muscle
  equipment?: Equipment
}

// Exercises used most recently sort first, then alphabetical.
export async function searchExercises(db: Db, f: ExerciseFilter = {}): Promise<Exercise[]> {
  const where = ['e.archived = 0']
  const params: SqlValue[] = []
  for (const word of (f.query ?? '').trim().split(/\s+/).filter(Boolean)) {
    where.push('e.name LIKE ?')
    params.push(`%${word}%`)
  }
  if (f.muscle) {
    where.push("(',' || e.primary_muscles || ',' || e.secondary_muscles || ',') LIKE ?")
    params.push(`%,${f.muscle},%`)
  }
  if (f.equipment) {
    where.push('e.equipment = ?')
    params.push(f.equipment)
  }
  const rows = await db.all<ExerciseRow>(
    `SELECT e.* FROM exercises e
     LEFT JOIN (
       SELECT we.exercise_id, MAX(w.started_at) AS last_used
       FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
       GROUP BY we.exercise_id
     ) u ON u.exercise_id = e.id
     WHERE ${where.join(' AND ')}
     ORDER BY u.last_used IS NULL, u.last_used DESC, e.name`,
    params,
  )
  return rows.map(toExercise)
}

export async function getExercise(db: Db, id: number): Promise<Exercise | undefined> {
  const r = await db.get<ExerciseRow>('SELECT * FROM exercises WHERE id = ?', [id])
  return r && toExercise(r)
}

export async function getExercises(db: Db, ids: number[]): Promise<Map<number, Exercise>> {
  if (ids.length === 0) return new Map()
  const rows = await db.all<ExerciseRow>(`SELECT * FROM exercises WHERE id IN (${ids.map(() => '?').join(',')})`, ids)
  return new Map(rows.map((r) => [r.id, toExercise(r)]))
}

export async function createCustomExercise(db: Db, e: ExerciseInput): Promise<number> {
  const { lastId } = await db.run(
    `INSERT INTO exercises
       (name, strava_exercise_type, category, primary_muscles, secondary_muscles, equipment, tracking, default_rest_s, is_custom)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      e.name,
      e.stravaExerciseType,
      e.category,
      e.primaryMuscles.join(','),
      e.secondaryMuscles.join(','),
      e.equipment,
      e.tracking,
      e.defaultRestS,
    ],
  )
  return lastId
}

// Built-ins keep their Strava ID; everything else is editable.
export async function updateExercise(db: Db, id: number, e: ExerciseInput): Promise<void> {
  await db.run(
    `UPDATE exercises SET
       name = ?, category = ?, primary_muscles = ?, secondary_muscles = ?, equipment = ?, tracking = ?, default_rest_s = ?,
       strava_exercise_type = CASE WHEN is_custom = 1 THEN ? ELSE strava_exercise_type END
     WHERE id = ?`,
    [
      e.name,
      e.category,
      e.primaryMuscles.join(','),
      e.secondaryMuscles.join(','),
      e.equipment,
      e.tracking,
      e.defaultRestS,
      e.stravaExerciseType,
      id,
    ],
  )
}

export async function setExerciseArchived(db: Db, id: number, archived: boolean): Promise<void> {
  await db.run('UPDATE exercises SET archived = ? WHERE id = ?', [archived ? 1 : 0, id])
}
