import { create } from 'zustand'
import { getDb } from '../db/client'
import { getJson, setJson } from '../db/repos/kv'
import type { WeightUnit } from '../domain/units'
import type { ThemePref } from '../lib/theme'

export interface Settings {
  unit: WeightUnit
  restSound: boolean
  stravaAutoUpload: boolean
  theme: ThemePref
}

const DEFAULTS: Settings = { unit: 'kg', restSound: true, stravaAutoUpload: true, theme: 'system' }
const KEY = 'settings'

interface SettingsStore extends Settings {
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<Settings>) => Promise<void>
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  async load() {
    const saved = await getJson<Partial<Settings>>(await getDb(), KEY)
    set({ ...DEFAULTS, ...saved, loaded: true })
  },
  async update(patch) {
    set(patch)
    const { unit, restSound, stravaAutoUpload, theme } = get()
    await setJson(await getDb(), KEY, { unit, restSound, stravaAutoUpload, theme } satisfies Settings)
  },
}))
