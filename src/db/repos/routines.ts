import type { Db } from '../types'

export interface RoutineItem {
  exerciseId: number
  supersetGroup: number | null
  targetSets: number
  targetReps: number | null
  targetWeightKg: number | null
  targetDurationS: number | null
  restS: number | null
}

export interface Routine {
  id: number
  name: string
  notes: string
  items: RoutineItem[]
}

export interface RoutineSummary {
  id: number
  name: string
  exerciseNames: string[]
}

interface RoutineItemRow {
  routine_id: number
  exercise_id: number
  superset_group: number | null
  target_sets: number
  target_reps: number | null
  target_weight_kg: number | null
  target_duration_s: number | null
  rest_s: number | null
}

export async function listRoutines(db: Db): Promise<RoutineSummary[]> {
  const routines = await db.all<{ id: number; name: string }>('SELECT id, name FROM routines ORDER BY position, id')
  const names = await db.all<{ routine_id: number; name: string }>(
    `SELECT ri.routine_id, e.name FROM routine_items ri JOIN exercises e ON e.id = ri.exercise_id
     ORDER BY ri.routine_id, ri.position`,
  )
  return routines.map((r) => ({
    ...r,
    exerciseNames: names.filter((n) => n.routine_id === r.id).map((n) => n.name),
  }))
}

export async function getRoutine(db: Db, id: number): Promise<Routine | undefined> {
  const r = await db.get<{ id: number; name: string; notes: string }>('SELECT id, name, notes FROM routines WHERE id = ?', [
    id,
  ])
  if (!r) return undefined
  const items = await db.all<RoutineItemRow>('SELECT * FROM routine_items WHERE routine_id = ? ORDER BY position', [id])
  return {
    ...r,
    items: items.map((i) => ({
      exerciseId: i.exercise_id,
      supersetGroup: i.superset_group,
      targetSets: i.target_sets,
      targetReps: i.target_reps,
      targetWeightKg: i.target_weight_kg,
      targetDurationS: i.target_duration_s,
      restS: i.rest_s,
    })),
  }
}

// Inserts when id is undefined. Items are replaced wholesale.
export async function saveRoutine(db: Db, r: Omit<Routine, 'id'> & { id?: number }): Promise<number> {
  return db.tx(async () => {
    let id = r.id
    if (id === undefined) {
      const next = await db.get<{ p: number }>('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM routines')
      id = (
        await db.run('INSERT INTO routines (name, notes, position, created_at) VALUES (?, ?, ?, ?)', [
          r.name,
          r.notes,
          next!.p,
          Date.now(),
        ])
      ).lastId
    } else {
      await db.run('UPDATE routines SET name = ?, notes = ? WHERE id = ?', [r.name, r.notes, id])
      await db.run('DELETE FROM routine_items WHERE routine_id = ?', [id])
    }
    for (const [position, i] of r.items.entries()) {
      await db.run(
        `INSERT INTO routine_items
           (routine_id, exercise_id, position, superset_group, target_sets, target_reps, target_weight_kg, target_duration_s, rest_s)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          i.exerciseId,
          position,
          i.supersetGroup,
          i.targetSets,
          i.targetReps,
          i.targetWeightKg,
          i.targetDurationS,
          i.restS,
        ],
      )
    }
    return id
  })
}

export async function deleteRoutine(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM routines WHERE id = ?', [id])
}
