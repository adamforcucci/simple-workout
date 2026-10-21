import type { Db } from '../types'

export type SyncStatus = 'uploading' | 'processing' | 'done' | 'error'

export interface StravaSync {
  workoutId: number
  uploadId: number | null
  activityId: number | null
  status: SyncStatus
  error: string | null
  updatedAt: number
}

interface Row {
  workout_id: number
  upload_id: number | null
  activity_id: number | null
  status: SyncStatus
  error: string | null
  updated_at: number
}

const toSync = (r: Row): StravaSync => ({
  workoutId: r.workout_id,
  uploadId: r.upload_id,
  activityId: r.activity_id,
  status: r.status,
  error: r.error,
  updatedAt: r.updated_at,
})

export async function getSync(db: Db, workoutId: number): Promise<StravaSync | undefined> {
  const r = await db.get<Row>('SELECT * FROM strava_sync WHERE workout_id = ?', [workoutId])
  return r && toSync(r)
}

export async function saveSync(db: Db, s: Omit<StravaSync, 'updatedAt'>): Promise<StravaSync> {
  const updatedAt = Date.now()
  await db.run(
    `INSERT INTO strava_sync (workout_id, upload_id, activity_id, status, error, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (workout_id) DO UPDATE SET
       upload_id = excluded.upload_id, activity_id = excluded.activity_id, status = excluded.status,
       error = excluded.error, updated_at = excluded.updated_at`,
    [s.workoutId, s.uploadId, s.activityId, s.status, s.error, updatedAt],
  )
  return { ...s, updatedAt }
}

export async function clearSync(db: Db, workoutId: number): Promise<void> {
  await db.run('DELETE FROM strava_sync WHERE workout_id = ?', [workoutId])
}
