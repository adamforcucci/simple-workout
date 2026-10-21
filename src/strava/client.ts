import { CapacitorHttp } from '@capacitor/core'
import { getDb } from '../db/client'
import { getHrSamples } from '../db/repos/hr'
import { deleteKey, getJson, setJson } from '../db/repos/kv'
import { getSync, saveSync, type StravaSync } from '../db/repos/strava'
import { getWorkout } from '../db/repos/workouts'
import type { WeightUnit } from '../domain/units'
import { buildStrengthUpload, describeWorkout, multipartBody } from './payload'

// Personal, single-user app: the client secret ships in the bundle (from .env).
const CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID as string | undefined
const CLIENT_SECRET = import.meta.env.VITE_STRAVA_CLIENT_SECRET as string | undefined
const API = 'https://www.strava.com/api/v3'
const AUTH_KEY = 'stravaAuth'
export const REDIRECT_URI = 'adamsgym://strava.local/callback'
// activity:read_all lets us read back (and update) what we upload.
const SCOPE = 'read,activity:write,activity:read_all'

export interface StravaAuth {
  accessToken: string
  refreshToken: string
  expiresAt: number // epoch seconds
  athlete: { id: number; firstname: string; lastname: string }
}

export class StravaError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

export const isConfigured = () => !!CLIENT_ID && !!CLIENT_SECRET

export function authorizeUrl(): string {
  const url = new URL('https://www.strava.com/oauth/mobile/authorize')
  url.search = new URLSearchParams({
    client_id: CLIENT_ID ?? '',
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE,
  }).toString()
  return url.toString()
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete?: StravaAuth['athlete']
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await CapacitorHttp.request({
    method: 'POST',
    url: 'https://www.strava.com/oauth/token',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: { client_id: CLIENT_ID ?? '', client_secret: CLIENT_SECRET ?? '', ...params },
  })
  if (res.status !== 200) throw new StravaError(`Strava sign-in failed (${res.status})`, res.status)
  return res.data as TokenResponse
}

export async function getAuth(): Promise<StravaAuth | undefined> {
  return getJson<StravaAuth>(await getDb(), AUTH_KEY)
}

export async function exchangeCode(code: string): Promise<StravaAuth> {
  const t = await tokenRequest({ code, grant_type: 'authorization_code' })
  const auth: StravaAuth = {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: t.expires_at,
    athlete: t.athlete ?? { id: 0, firstname: '', lastname: '' },
  }
  await setJson(await getDb(), AUTH_KEY, auth)
  return auth
}

// A token that's good for at least another minute, refreshing if needed.
async function accessToken(): Promise<string> {
  const auth = await getAuth()
  if (!auth) throw new StravaError('Not connected to Strava')
  if (auth.expiresAt - 60 > Date.now() / 1000) return auth.accessToken
  const t = await tokenRequest({ refresh_token: auth.refreshToken, grant_type: 'refresh_token' })
  const next = { ...auth, accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at }
  await setJson(await getDb(), AUTH_KEY, next)
  return next.accessToken
}

async function api<T>(method: string, path: string, init: { data?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const res = await CapacitorHttp.request({
    method,
    url: path.startsWith('https://') ? path : `${API}${path}`,
    headers: { Authorization: `Bearer ${await accessToken()}`, ...init.headers },
    data: init.data,
  })
  if (res.status === 401) throw new StravaError('Strava access was revoked — reconnect in Profile', 401)
  if (res.status >= 400) {
    const msg = (res.data as { message?: string } | undefined)?.message
    throw new StravaError(`Strava error ${res.status}${msg ? `: ${msg}` : ''}`, res.status)
  }
  return res.data as T
}

export async function disconnect(): Promise<void> {
  const db = await getDb()
  try {
    await api('POST', 'https://www.strava.com/oauth/deauthorize')
  } catch {
    // Already revoked or offline: forget it locally either way.
  }
  await deleteKey(db, AUTH_KEY)
}

interface UploadResponse {
  id: number
  status: string
  error: string | null
  activity_id: number | null
}

// Strava reports re-uploads as an error naming the existing activity.
function duplicateActivityId(error: string | null): number | null {
  if (!error || !/duplicate/i.test(error)) return null
  const m = error.match(/activities\/(\d+)/) ?? error.match(/(\d{6,})/)
  return m ? Number(m[1]) : null
}

function interpret(workoutId: number, r: UploadResponse): Omit<StravaSync, 'updatedAt'> {
  const dup = duplicateActivityId(r.error)
  if (r.activity_id || dup)
    return { workoutId, uploadId: r.id, activityId: r.activity_id ?? dup, status: 'done', error: null }
  if (r.error) return { workoutId, uploadId: r.id, activityId: null, status: 'error', error: r.error }
  return { workoutId, uploadId: r.id, activityId: null, status: 'processing', error: null }
}

const POLL_INTERVAL_MS = 2000
const POLL_ATTEMPTS = 30
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Waits for Strava to finish processing an upload (≈ a few seconds).
export async function pollUpload(workoutId: number, onUpdate?: (s: StravaSync) => void): Promise<StravaSync> {
  const db = await getDb()
  let sync = await getSync(db, workoutId)
  for (let i = 0; sync?.status === 'processing' && sync.uploadId && i < POLL_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS)
    const r = await api<UploadResponse>('GET', `/uploads/${sync.uploadId}`)
    sync = await saveSync(db, interpret(workoutId, r))
    onUpdate?.(sync)
  }
  if (!sync) throw new StravaError('No upload in progress')
  return sync
}

export async function uploadWorkout(workoutId: number, unit: WeightUnit, onUpdate?: (s: StravaSync) => void): Promise<StravaSync> {
  const db = await getDb()
  const workout = await getWorkout(db, workoutId)
  if (!workout || workout.endedAt === null) throw new StravaError('Workout not found')
  onUpdate?.(await saveSync(db, { workoutId, uploadId: null, activityId: null, status: 'uploading', error: null }))
  try {
    const payload = buildStrengthUpload(workout, await getHrSamples(db, workoutId))
    const { body, contentType } = multipartBody(
      {
        data_type: 'json',
        name: workout.name,
        description: describeWorkout(workout, unit),
        external_id: `gym-${workoutId}-${workout.startedAt}`,
      },
      { name: 'file', filename: `workout-${workoutId}.json`, content: JSON.stringify(payload) },
    )
    const r = await api<UploadResponse>('POST', '/uploads', { data: body, headers: { 'Content-Type': contentType } })
    const sync = await saveSync(db, interpret(workoutId, r))
    onUpdate?.(sync)
    return sync.status === 'processing' ? pollUpload(workoutId, onUpdate) : sync
  } catch (err) {
    const sync = await saveSync(db, {
      workoutId,
      uploadId: null,
      activityId: null,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    })
    onUpdate?.(sync)
    return sync
  }
}
