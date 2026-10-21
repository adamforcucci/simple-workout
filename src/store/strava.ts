import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { create } from 'zustand'
import { getDb } from '../db/client'
import { getSync, type StravaSync } from '../db/repos/strava'
import {
  authorizeUrl,
  disconnect,
  exchangeCode,
  getAuth,
  isConfigured,
  pollUpload,
  REDIRECT_URI,
  refreshAthleteIfStale,
  uploadWorkout,
  type StravaAuth,
} from '../strava/client'
import { useSettings } from './settings'

interface StravaStore {
  auth: StravaAuth | null
  connecting: boolean
  error: string | null
  // Sync state per workout, loaded on demand and updated live during uploads.
  syncs: Record<number, StravaSync | undefined>
  load: () => Promise<void>
  connect: () => Promise<void>
  handleRedirect: (url: string) => Promise<void>
  disconnect: () => Promise<void>
  loadSync: (workoutId: number) => Promise<void>
  upload: (workoutId: number) => Promise<void>
}

export const useStrava = create<StravaStore>((set, get) => {
  const track = (s: StravaSync) => set((st) => ({ syncs: { ...st.syncs, [s.workoutId]: s } }))
  const inFlight = new Set<number>()

  return {
    auth: null,
    connecting: false,
    error: null,
    syncs: {},

    async load() {
      set({ auth: (await getAuth()) ?? null })
      // Keep the cached athlete name within Strava's 7-day limit (offline is fine).
      void refreshAthleteIfStale()
        .then((auth) => set({ auth: auth ?? null }))
        .catch(async () => set({ auth: (await getAuth()) ?? null }))
      // The OAuth redirect comes back into the app via the adamsgym:// link.
      void CapApp.addListener('appUrlOpen', ({ url }) => void get().handleRedirect(url))
      const launch = await CapApp.getLaunchUrl()
      if (launch?.url) await get().handleRedirect(launch.url)
    },

    async connect() {
      if (!isConfigured()) {
        set({ error: 'Strava client ID or token server URL missing from .env' })
        return
      }
      set({ connecting: true, error: null })
      await Browser.open({ url: authorizeUrl() })
    },

    async handleRedirect(url) {
      if (!url.startsWith(REDIRECT_URI)) return
      const params = new URL(url).searchParams
      void Browser.close().catch(() => {})
      const code = params.get('code')
      if (!code) {
        set({ connecting: false, error: params.get('error') === 'access_denied' ? 'Strava access was declined' : 'Strava sign-in failed' })
        return
      }
      try {
        set({ auth: await exchangeCode(code), connecting: false, error: null })
      } catch (err) {
        set({ connecting: false, error: err instanceof Error ? err.message : String(err) })
      }
    },

    async disconnect() {
      await disconnect()
      set({ auth: null })
    },

    async loadSync(workoutId) {
      const sync = await getSync(await getDb(), workoutId)
      set((st) => ({ syncs: { ...st.syncs, [workoutId]: sync } }))
      // Resume an upload that was still processing when the app last closed.
      if (sync?.status === 'processing' && !inFlight.has(workoutId)) {
        inFlight.add(workoutId)
        await pollUpload(workoutId, track)
          .catch(() => {})
          .finally(() => inFlight.delete(workoutId))
      }
    },

    async upload(workoutId) {
      if (inFlight.has(workoutId)) return
      inFlight.add(workoutId)
      try {
        await uploadWorkout(workoutId, useSettings.getState().unit, track)
      } finally {
        inFlight.delete(workoutId)
        // A 401 during the upload clears the tokens; reflect that in the UI.
        set({ auth: (await getAuth()) ?? null })
      }
    },
  }
})
