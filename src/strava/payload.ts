import type { HrSample } from '../db/repos/hr'
import type { Workout } from '../db/repos/workouts'
import { toDisplayWeight, type WeightUnit } from '../domain/units'
import { formatClock } from '../lib/format'

// Strava's JSON strength upload format:
// https://developers.strava.com/docs/uploads/ — renders Strava's own workout
// log and muscle map for WeightTraining activities.
export interface StravaStrengthUpload {
  version: '1.0'
  start_time: string
  utc_offset: number
  elapsed_time: number
  total_calories?: number
  creator: { name: string }
  sets: StravaSet[]
  streams?: { time: number[]; heartrate: number[] }
}

export interface StravaSet {
  exercise_type: string
  repetitions?: number
  weight?: number
  duration?: number
  start_time?: string
}

// Sets only record when they were ticked off; estimate when each began so
// Strava's timeline is plausible (timed sets use their duration).
const SECONDS_PER_REP = 3
const MIN_SET_SECONDS = 15

export function buildStrengthUpload(w: Workout, hr: HrSample[]): StravaStrengthUpload {
  const endedAt = w.endedAt ?? w.startedAt
  const sets: StravaSet[] = []
  for (const e of w.exercises) {
    for (const s of e.sets) {
      const set: StravaSet = { exercise_type: e.stravaExerciseType }
      if (s.reps) set.repetitions = s.reps
      if (s.weightKg) set.weight = Math.round(s.weightKg * 100) / 100
      if (s.durationS) set.duration = s.durationS
      if (s.completedAt) {
        const length = s.durationS ?? Math.max(MIN_SET_SECONDS, (s.reps ?? 0) * SECONDS_PER_REP)
        set.start_time = new Date(Math.max(w.startedAt, s.completedAt - length * 1000)).toISOString()
      }
      sets.push(set)
    }
  }

  const upload: StravaStrengthUpload = {
    version: '1.0',
    start_time: new Date(w.startedAt).toISOString(),
    utc_offset: w.utcOffsetS,
    elapsed_time: Math.max(1, Math.round((endedAt - w.startedAt) / 1000)),
    creator: { name: 'Workout' },
    sets,
  }
  if (w.calories) upload.total_calories = w.calories
  if (hr.length > 1) upload.streams = { time: hr.map((s) => s.t), heartrate: hr.map((s) => s.bpm) }
  return upload
}

// "Barbell Bench Press: 60 kg × 8, 60 kg × 8" per exercise, for the activity description.
export function describeWorkout(w: Workout, unit: WeightUnit): string {
  const lines = w.exercises.map((e) => {
    const sets = e.sets.map((s) => {
      if (s.durationS) return formatClock(s.durationS)
      const reps = s.reps ?? 0
      return s.weightKg ? `${toDisplayWeight(s.weightKg, unit)} ${unit} × ${reps}` : `${reps} reps`
    })
    return `${e.supersetGroup ? '↔ ' : ''}${e.name}: ${sets.join(', ')}`
  })
  if (w.notes.trim()) lines.push('', w.notes.trim())
  return lines.join('\n')
}

// Hand-built multipart body: the upload is all text, and this goes through
// Capacitor's native HTTP (no CORS) which sends string bodies as-is.
export function multipartBody(fields: Record<string, string>, file: { name: string; filename: string; content: string }) {
  const boundary = `----gym${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
  const parts = Object.entries(fields).map(
    ([k, v]) => `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
  )
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\n` +
      `Content-Type: application/json\r\n\r\n${file.content}\r\n`,
  )
  return { body: `${parts.join('')}--${boundary}--\r\n`, contentType: `multipart/form-data; boundary=${boundary}` }
}
