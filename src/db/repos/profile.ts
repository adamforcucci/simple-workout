import type { Db } from '../types'

export type Sex = 'male' | 'female'

export interface Profile {
  name: string
  dob: string | null
  sex: Sex | null
  heightCm: number | null
  maxHrOverride: number | null
}

export interface BodyMetric {
  id: number
  date: string
  weightKg: number | null
  bodyFatPct: number | null
}

interface ProfileRow {
  name: string
  dob: string | null
  sex: Sex | null
  height_cm: number | null
  max_hr_override: number | null
}

interface BodyMetricRow {
  id: number
  date: string
  weight_kg: number | null
  body_fat_pct: number | null
}

export async function getProfile(db: Db): Promise<Profile> {
  const r = (await db.get<ProfileRow>('SELECT * FROM profile WHERE id = 1'))!
  return { name: r.name, dob: r.dob, sex: r.sex, heightCm: r.height_cm, maxHrOverride: r.max_hr_override }
}

export async function saveProfile(db: Db, p: Profile): Promise<void> {
  await db.run('UPDATE profile SET name = ?, dob = ?, sex = ?, height_cm = ?, max_hr_override = ? WHERE id = 1', [
    p.name,
    p.dob,
    p.sex,
    p.heightCm,
    p.maxHrOverride,
  ])
}

export async function listBodyMetrics(db: Db): Promise<BodyMetric[]> {
  const rows = await db.all<BodyMetricRow>('SELECT * FROM body_metrics ORDER BY date')
  return rows.map((r) => ({ id: r.id, date: r.date, weightKg: r.weight_kg, bodyFatPct: r.body_fat_pct }))
}

// Latest recorded body weight on or before `date` (YYYY-MM-DD).
export async function bodyWeightOn(db: Db, date: string): Promise<number | null> {
  const r = await db.get<{ weight_kg: number }>(
    'SELECT weight_kg FROM body_metrics WHERE date <= ? AND weight_kg IS NOT NULL ORDER BY date DESC LIMIT 1',
    [date],
  )
  return r?.weight_kg ?? null
}

export async function upsertBodyMetric(db: Db, m: Omit<BodyMetric, 'id'>): Promise<void> {
  await db.run(
    `INSERT INTO body_metrics (date, weight_kg, body_fat_pct) VALUES (?, ?, ?)
     ON CONFLICT (date) DO UPDATE SET weight_kg = excluded.weight_kg, body_fat_pct = excluded.body_fat_pct`,
    [m.date, m.weightKg, m.bodyFatPct],
  )
}

export async function deleteBodyMetric(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM body_metrics WHERE id = ?', [id])
}
