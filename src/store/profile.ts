import { create } from 'zustand'
import { getDb } from '../db/client'
import {
  deleteBodyMetric,
  getProfile,
  listBodyMetrics,
  saveProfile,
  upsertBodyMetric,
  type BodyMetric,
  type Profile,
} from '../db/repos/profile'

interface ProfileStore {
  profile: Profile | null
  bodyMetrics: BodyMetric[]
  load: () => Promise<void>
  save: (p: Profile) => Promise<void>
  logWeight: (date: string, weightKg: number) => Promise<void>
  deleteMetric: (id: number) => Promise<void>
}

export const useProfile = create<ProfileStore>((set, get) => ({
  profile: null,
  bodyMetrics: [],

  async load() {
    const db = await getDb()
    set({ profile: await getProfile(db), bodyMetrics: await listBodyMetrics(db) })
  },

  async save(p) {
    set({ profile: p })
    await saveProfile(await getDb(), p)
  },

  async logWeight(date, weightKg) {
    const db = await getDb()
    const existing = get().bodyMetrics.find((m) => m.date === date)
    await upsertBodyMetric(db, { date, weightKg, bodyFatPct: existing?.bodyFatPct ?? null })
    set({ bodyMetrics: await listBodyMetrics(db) })
  },

  async deleteMetric(id) {
    const db = await getDb()
    await deleteBodyMetric(db, id)
    set({ bodyMetrics: get().bodyMetrics.filter((m) => m.id !== id) })
  },
}))

// Most recent logged body weight, for calorie estimates.
export const latestWeightKg = (metrics: BodyMetric[]) => metrics.findLast((m) => m.weightKg !== null)?.weightKg ?? null
