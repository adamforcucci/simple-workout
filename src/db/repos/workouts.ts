import type { Db, SqlValue } from '../types'

export type SetType = 'warmup' | 'normal' | 'drop' | 'failure'

export interface LoggedSet {
  type: SetType
  weightKg: number | null
  reps: number | null
  durationS: number | null
  rpe: number | null
  completedAt: number | null
}

export interface LoggedExercise {
  exerciseId: number
  supersetGroup: number | null
  restS: number
  notes: string
  sets: LoggedSet[]
}

export interface WorkoutMeta {
  id: number
  name: string
  notes: string
  routineId: number | null
  startedAt: number
  endedAt: number | null
  utcOffsetS: number
  avgHr: number | null
  maxHr: number | null
  calories: number | null
}

export interface Workout extends WorkoutMeta {
  exercises: (LoggedExercise & { name: string; stravaExerciseType: string })[]
}

export interface WorkoutSummary extends WorkoutMeta {
  exerciseCount: number
  setCount: number
  volumeKg: number
}

export interface FinishInput {
  name: string
  notes: string
  endedAt: number
  exercises: LoggedExercise[]
  avgHr: number | null
  maxHr: number | null
  calories: number | null
}

interface WorkoutRow {
  id: number
  name: string
  notes: string
  routine_id: number | null
  started_at: number
  ended_at: number | null
  utc_offset_s: number
  avg_hr: number | null
  max_hr: number | null
  calories: number | null
}

interface SetJoinRow {
  we_id: number
  exercise_id: number
  exercise_name: string
  strava_exercise_type: string
  superset_group: number | null
  rest_s: number
  we_notes: string
  type: SetType | null
  weight_kg: number | null
  reps: number | null
  duration_s: number | null
  rpe: number | null
  completed_at: number | null
}

function toMeta(r: WorkoutRow): WorkoutMeta {
  return {
    id: r.id,
    name: r.name,
    notes: r.notes,
    routineId: r.routine_id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    utcOffsetS: r.utc_offset_s,
    avgHr: r.avg_hr,
    maxHr: r.max_hr,
    calories: r.calories,
  }
}

function toSet(r: SetJoinRow): LoggedSet {
  return {
    type: r.type!,
    weightKg: r.weight_kg,
    reps: r.reps,
    durationS: r.duration_s,
    rpe: r.rpe,
    completedAt: r.completed_at,
  }
}

export async function startWorkout(
  db: Db,
  w: { name: string; routineId: number | null; startedAt: number; utcOffsetS: number },
): Promise<number> {
  const { lastId } = await db.run(
    'INSERT INTO workouts (name, routine_id, started_at, utc_offset_s) VALUES (?, ?, ?, ?)',
    [w.name, w.routineId, w.startedAt, w.utcOffsetS],
  )
  return lastId
}

export async function getInProgressWorkout(db: Db): Promise<WorkoutMeta | undefined> {
  const r = await db.get<WorkoutRow>('SELECT * FROM workouts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1')
  return r && toMeta(r)
}

// Writes the logged exercises/sets and closes the workout. Re-running replaces
// what was written before, so editing a finished workout uses this too.
export async function finishWorkout(db: Db, id: number, f: FinishInput): Promise<void> {
  await db.tx(async () => {
    await db.run('DELETE FROM workout_exercises WHERE workout_id = ?', [id])
    for (const [position, e] of f.exercises.entries()) {
      const { lastId: weId } = await db.run(
        `INSERT INTO workout_exercises (workout_id, exercise_id, position, superset_group, rest_s, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, e.exerciseId, position, e.supersetGroup, e.restS, e.notes],
      )
      for (const [setPos, s] of e.sets.entries()) {
        await db.run(
          `INSERT INTO sets (workout_exercise_id, position, type, weight_kg, reps, duration_s, rpe, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [weId, setPos, s.type, s.weightKg, s.reps, s.durationS, s.rpe, s.completedAt],
        )
      }
    }
    await db.run(
      'UPDATE workouts SET name = ?, notes = ?, ended_at = ?, avg_hr = ?, max_hr = ?, calories = ? WHERE id = ?',
      [f.name, f.notes, f.endedAt, f.avgHr, f.maxHr, f.calories, id],
    )
  })
}

export async function deleteWorkout(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM workouts WHERE id = ?', [id])
}

async function exercisesFor(db: Db, workoutId: number): Promise<Workout['exercises']> {
  const rows = await db.all<SetJoinRow>(
    `SELECT we.id AS we_id, we.exercise_id, e.name AS exercise_name, e.strava_exercise_type, we.superset_group, we.rest_s,
            we.notes AS we_notes, s.type, s.weight_kg, s.reps, s.duration_s, s.rpe, s.completed_at
     FROM workout_exercises we
     JOIN exercises e ON e.id = we.exercise_id
     LEFT JOIN sets s ON s.workout_exercise_id = we.id
     WHERE we.workout_id = ?
     ORDER BY we.position, s.position`,
    [workoutId],
  )
  const out: Workout['exercises'] = []
  let currentWe = -1
  for (const r of rows) {
    if (r.we_id !== currentWe) {
      currentWe = r.we_id
      out.push({
        exerciseId: r.exercise_id,
        name: r.exercise_name,
        stravaExerciseType: r.strava_exercise_type,
        supersetGroup: r.superset_group,
        restS: r.rest_s,
        notes: r.we_notes,
        sets: [],
      })
    }
    if (r.type) out[out.length - 1].sets.push(toSet(r))
  }
  return out
}

export async function getWorkout(db: Db, id: number): Promise<Workout | undefined> {
  const r = await db.get<WorkoutRow>('SELECT * FROM workouts WHERE id = ?', [id])
  if (!r) return undefined
  return { ...toMeta(r), exercises: await exercisesFor(db, id) }
}

// Finished workouts, newest first. `from`/`to` are epoch ms bounds on started_at.
export async function listWorkouts(db: Db, range: { from?: number; to?: number } = {}): Promise<WorkoutSummary[]> {
  const where = ['w.ended_at IS NOT NULL']
  const params: SqlValue[] = []
  if (range.from !== undefined) {
    where.push('w.started_at >= ?')
    params.push(range.from)
  }
  if (range.to !== undefined) {
    where.push('w.started_at < ?')
    params.push(range.to)
  }
  const rows = await db.all<WorkoutRow & { exercise_count: number; set_count: number; volume_kg: number }>(
    `SELECT w.*,
       (SELECT COUNT(*) FROM workout_exercises we WHERE we.workout_id = w.id) AS exercise_count,
       (SELECT COUNT(*) FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
          WHERE we.workout_id = w.id AND s.type != 'warmup') AS set_count,
       (SELECT COALESCE(SUM(s.weight_kg * s.reps), 0) FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
          WHERE we.workout_id = w.id AND s.type != 'warmup') AS volume_kg
     FROM workouts w
     WHERE ${where.join(' AND ')}
     ORDER BY w.started_at DESC`,
    params,
  )
  return rows.map((r) => ({
    ...toMeta(r),
    exerciseCount: r.exercise_count,
    setCount: r.set_count,
    volumeKg: r.volume_kg,
  }))
}

// Sets from the most recent finished workout that included this exercise,
// for the "previous" column while logging.
export async function previousSets(db: Db, exerciseId: number, beforeStartedAt = Date.now()): Promise<LoggedSet[]> {
  const we = await db.get<{ id: number }>(
    `SELECT we.id FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = ? AND w.ended_at IS NOT NULL AND w.started_at < ?
     ORDER BY w.started_at DESC, we.position LIMIT 1`,
    [exerciseId, beforeStartedAt],
  )
  if (!we) return []
  const rows = await db.all<SetJoinRow>('SELECT * FROM sets WHERE workout_exercise_id = ? ORDER BY position', [we.id])
  return rows.map(toSet)
}

export interface ExerciseSession {
  workoutId: number
  startedAt: number
  sets: LoggedSet[]
}

// Every finished session of one exercise, oldest first, for charts and history.
export async function exerciseHistory(db: Db, exerciseId: number): Promise<ExerciseSession[]> {
  const rows = await db.all<SetJoinRow & { workout_id: number; started_at: number }>(
    `SELECT w.id AS workout_id, w.started_at, s.*
     FROM workout_exercises we
     JOIN workouts w ON w.id = we.workout_id
     JOIN sets s ON s.workout_exercise_id = we.id
     WHERE we.exercise_id = ? AND w.ended_at IS NOT NULL
     ORDER BY w.started_at, we.position, s.position`,
    [exerciseId],
  )
  const out: ExerciseSession[] = []
  for (const r of rows) {
    if (out.at(-1)?.workoutId !== r.workout_id) out.push({ workoutId: r.workout_id, startedAt: r.started_at, sets: [] })
    out.at(-1)!.sets.push(toSet(r))
  }
  return out
}

export async function updateWorkoutMeta(db: Db, id: number, m: { name: string; notes: string }): Promise<void> {
  await db.run('UPDATE workouts SET name = ?, notes = ? WHERE id = ?', [m.name, m.notes, id])
}
