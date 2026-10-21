import { SecureStorage } from '@aparajita/capacitor-secure-storage'
import { Capacitor } from '@capacitor/core'
import { getDb } from '../db/client'
import { deleteKey, getJson, setJson } from '../db/repos/kv'

// Strava tokens live in the Android Keystore / iOS Keychain on the phone, not
// in the SQLite database (which backups and debug tools can read). The web
// build and tests fall back to the database's kv table.
const KEY = 'stravaAuth'
const native = () => Capacitor.isNativePlatform()

export async function readAuth<T>(): Promise<T | undefined> {
  if (!native()) return getJson<T>(await getDb(), KEY)
  const raw = await SecureStorage.getItem(KEY)
  if (raw) return JSON.parse(raw) as T
  // One-time move of tokens saved by earlier versions.
  const db = await getDb()
  const legacy = await getJson<T>(db, KEY)
  if (legacy) {
    await SecureStorage.setItem(KEY, JSON.stringify(legacy))
    await deleteKey(db, KEY)
  }
  return legacy
}

export async function writeAuth(auth: unknown): Promise<void> {
  if (!native()) return setJson(await getDb(), KEY, auth)
  await SecureStorage.setItem(KEY, JSON.stringify(auth))
}

export async function clearAuth(): Promise<void> {
  if (native()) await SecureStorage.removeItem(KEY)
  await deleteKey(await getDb(), KEY)
}
