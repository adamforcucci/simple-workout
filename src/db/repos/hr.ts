import type { Db } from '../types'

export interface HrSample {
  t: number // seconds since workout start
  bpm: number
}

export async function appendHrSamples(db: Db, workoutId: number, samples: HrSample[]): Promise<void> {
  await db.batch(
    'INSERT OR REPLACE INTO hr_samples (workout_id, t_offset_s, bpm) VALUES (?, ?, ?)',
    samples.map((s) => [workoutId, s.t, s.bpm]),
  )
}

export async function getHrSamples(db: Db, workoutId: number): Promise<HrSample[]> {
  return db.all<HrSample>('SELECT t_offset_s AS t, bpm FROM hr_samples WHERE workout_id = ? ORDER BY t_offset_s', [
    workoutId,
  ])
}

export async function hrSummary(db: Db, workoutId: number): Promise<{ avg: number | null; max: number | null }> {
  const r = await db.get<{ avg: number | null; max: number | null }>(
    'SELECT ROUND(AVG(bpm)) AS avg, MAX(bpm) AS max FROM hr_samples WHERE workout_id = ?',
    [workoutId],
  )
  return { avg: r?.avg ?? null, max: r?.max ?? null }
}
