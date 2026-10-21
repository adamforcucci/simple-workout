import { beforeEach, describe, expect, test, vi } from 'vitest'
import { migrate } from '../db/migrations'
import { appendHrSamples } from '../db/repos/hr'
import { getJson, setJson } from '../db/repos/kv'
import { getSync } from '../db/repos/strava'
import { finishWorkout, getWorkout, startWorkout, type Workout } from '../db/repos/workouts'
import { seedExercises } from '../db/seed'
import { sqlJsDb } from '../db/sqlJsDb'
import type { Db } from '../db/types'
import { buildStrengthUpload, describeWorkout, multipartBody } from './payload'

let db: Db
vi.mock('../db/client', () => ({ getDb: () => Promise.resolve(db) }))

// Fake Strava: records requests, answers from a queue.
const http = vi.hoisted(() => ({
  requests: [] as { method: string; url: string; headers?: Record<string, string>; data?: unknown }[],
  responses: [] as { status: number; data: unknown }[],
}))
vi.mock('@capacitor/core', async (orig) => ({
  ...(await orig<typeof import('@capacitor/core')>()),
  CapacitorHttp: {
    request: async (r: (typeof http.requests)[number]) => {
      http.requests.push(r)
      return http.responses.shift() ?? { status: 500, data: {} }
    },
  },
}))
vi.stubEnv('VITE_STRAVA_CLIENT_ID', '123')
vi.stubEnv('VITE_TOKEN_API_URL', 'https://token.test/')

const { getAuth, refreshAthleteIfStale, uploadWorkout } = await import('./client')

const T0 = Date.UTC(2026, 9, 20, 21, 0, 0) // 8am AEDT on the 21st

async function seedWorkout(): Promise<Workout> {
  const ex = async (id: string) =>
    (await db.get<{ id: number }>('SELECT id FROM exercises WHERE strava_exercise_type = ?', [id]))!.id
  const id = await startWorkout(db, { name: 'Push', routineId: null, startedAt: T0, utcOffsetS: 39600 })
  await finishWorkout(db, id, {
    name: 'Push',
    notes: 'Felt strong',
    endedAt: T0 + 45 * 60_000,
    avgHr: 120,
    maxHr: 150,
    calories: 310,
    exercises: [
      {
        exerciseId: await ex('BARBELL_BENCH_PRESS'),
        supersetGroup: null,
        restS: 120,
        notes: '',
        sets: [
          { type: 'warmup', weightKg: 40, reps: 10, durationS: null, rpe: null, completedAt: T0 + 120_000 },
          { type: 'normal', weightKg: 62.5, reps: 8, durationS: null, rpe: null, completedAt: T0 + 300_000 },
        ],
      },
      {
        exerciseId: await ex('PLANK_GENERIC'),
        supersetGroup: null,
        restS: 60,
        notes: '',
        sets: [{ type: 'normal', weightKg: null, reps: null, durationS: 60, rpe: null, completedAt: T0 + 600_000 }],
      },
    ],
  })
  await appendHrSamples(db, id, [
    { t: 0, bpm: 90 },
    { t: 1, bpm: 92 },
    { t: 2, bpm: 95 },
  ])
  return (await getWorkout(db, id))!
}

beforeEach(async () => {
  db = await sqlJsDb()
  await migrate(db)
  await seedExercises(db)
  http.requests = []
  http.responses = []
})

describe('upload payload', () => {
  test('matches Strava’s JSON strength format', async () => {
    const w = await seedWorkout()
    const p = buildStrengthUpload(w, [
      { t: 0, bpm: 90 },
      { t: 5, bpm: 100 },
    ])
    expect(p).toMatchObject({
      version: '1.0',
      start_time: '2026-10-20T21:00:00.000Z',
      utc_offset: 39600,
      elapsed_time: 2700,
      total_calories: 310,
      streams: { time: [0, 5], heartrate: [90, 100] },
    })
    expect(p.sets).toEqual([
      { exercise_type: 'BARBELL_BENCH_PRESS', repetitions: 10, weight: 40, start_time: '2026-10-20T21:01:30.000Z' },
      { exercise_type: 'BARBELL_BENCH_PRESS', repetitions: 8, weight: 62.5, start_time: '2026-10-20T21:04:36.000Z' },
      { exercise_type: 'PLANK_GENERIC', duration: 60, start_time: '2026-10-20T21:09:00.000Z' },
    ])
  })

  test('omits streams without heart rate', async () => {
    expect(buildStrengthUpload(await seedWorkout(), []).streams).toBeUndefined()
  })

  test('description lists sets in the chosen unit, then notes', async () => {
    expect(describeWorkout(await seedWorkout(), 'kg')).toBe(
      'Barbell Bench Press: 40 kg × 10, 62.5 kg × 8\nPlank (General): 1:00\n\nFelt strong',
    )
  })

  test('multipart body is well-formed', () => {
    const { body, contentType } = multipartBody({ data_type: 'json' }, { name: 'file', filename: 'w.json', content: '{"a":1}' })
    const boundary = contentType.split('boundary=')[1]
    expect(body).toBe(
      `--${boundary}\r\nContent-Disposition: form-data; name="data_type"\r\n\r\njson\r\n` +
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="w.json"\r\nContent-Type: application/json\r\n\r\n{"a":1}\r\n` +
        `--${boundary}--\r\n`,
    )
  })
})

describe('upload flow', () => {
  const auth = (expiresAt: number) => ({
    accessToken: 'old',
    refreshToken: 'r1',
    expiresAt,
    athlete: { id: 1, firstname: 'Adam', lastname: '' },
  })

  test('uploads with a valid token, polls until ready, and records the activity', async () => {
    const w = await seedWorkout()
    await setJson(db, 'stravaAuth', auth(Date.now() / 1000 + 3600))
    http.responses.push(
      { status: 201, data: { id: 77, status: 'processing', error: null, activity_id: null } },
      { status: 200, data: { id: 77, status: 'ready', error: null, activity_id: 555 } },
    )
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 500 })
    const sync = await uploadWorkout(w.id, 'kg')
    vi.useRealTimers()

    expect(sync).toMatchObject({ status: 'done', activityId: 555, uploadId: 77 })
    expect(await getSync(db, w.id)).toMatchObject({ status: 'done', activityId: 555 })
    const [post, poll] = http.requests
    expect(post).toMatchObject({ method: 'POST', url: 'https://www.strava.com/api/v3/uploads' })
    expect(post.headers?.Authorization).toBe('Bearer old')
    expect(post.data as string).toContain('name="data_type"\r\n\r\njson')
    expect(post.data as string).toContain('"exercise_type":"BARBELL_BENCH_PRESS"')
    expect(poll).toMatchObject({ method: 'GET', url: 'https://www.strava.com/api/v3/uploads/77' })
  })

  test('refreshes an expiring token first', async () => {
    const w = await seedWorkout()
    await setJson(db, 'stravaAuth', auth(Date.now() / 1000 + 10))
    http.responses.push(
      { status: 200, data: { access_token: 'new', refresh_token: 'r2', expires_at: Date.now() / 1000 + 21600 } },
      { status: 201, data: { id: 78, status: 'ready', error: null, activity_id: 556 } },
    )
    await uploadWorkout(w.id, 'kg')
    // Goes via our token server (the secret isn't in the app), and sends only the refresh token.
    expect(http.requests[0]).toMatchObject({ url: 'https://token.test/api/strava/refresh', data: { refresh_token: 'r1' } })
    expect(JSON.stringify(http.requests[0])).not.toMatch(/secret/i)
    expect(http.requests[1].headers?.Authorization).toBe('Bearer new')
    expect(await getJson(db, 'stravaAuth')).toMatchObject({ accessToken: 'new', refreshToken: 'r2' })
  })

  test('a duplicate links to the existing activity', async () => {
    const w = await seedWorkout()
    await setJson(db, 'stravaAuth', auth(Date.now() / 1000 + 3600))
    http.responses.push({
      status: 201,
      data: { id: 79, status: 'There was an error', error: "gym-1.json duplicate of <a href='/activities/12345678'>Push</a>", activity_id: null },
    })
    expect(await uploadWorkout(w.id, 'kg')).toMatchObject({ status: 'done', activityId: 12345678 })
  })

  test('a rejected refresh disconnects instead of retrying forever', async () => {
    const w = await seedWorkout()
    await setJson(db, 'stravaAuth', auth(Date.now() / 1000 + 10))
    http.responses.push({ status: 401, data: { error: 'invalid_grant' } })
    expect(await uploadWorkout(w.id, 'kg')).toMatchObject({ status: 'error', error: expect.stringContaining('revoked') })
    expect(await getAuth()).toBeUndefined()
  })

  test('athlete name is re-read from Strava once it is over 7 days old', async () => {
    await setJson(db, 'stravaAuth', { ...auth(Date.now() / 1000 + 3600), athleteFetchedAt: Date.now() - 8 * 86_400_000 })
    http.responses.push({ status: 200, data: { id: 1, firstname: 'Adam', lastname: 'Forcucci', city: 'x' } })
    const updated = await refreshAthleteIfStale()
    expect(http.requests[0]).toMatchObject({ method: 'GET', url: 'https://www.strava.com/api/v3/athlete' })
    expect(updated?.athlete).toEqual({ id: 1, firstname: 'Adam', lastname: 'Forcucci' })

    http.requests = []
    await refreshAthleteIfStale() // fresh now: no request
    expect(http.requests).toHaveLength(0)
  })

  test('errors are recorded for retry', async () => {
    const w = await seedWorkout()
    await setJson(db, 'stravaAuth', auth(Date.now() / 1000 + 3600))
    http.responses.push({ status: 401, data: {} })
    expect(await uploadWorkout(w.id, 'kg')).toMatchObject({ status: 'error', error: expect.stringContaining('revoked') })
  })
})
