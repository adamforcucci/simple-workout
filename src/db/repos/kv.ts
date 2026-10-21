import type { Db } from '../types'

export async function getJson<T>(db: Db, key: string): Promise<T | undefined> {
  const row = await db.get<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key])
  return row ? (JSON.parse(row.value) as T) : undefined
}

export async function setJson(db: Db, key: string, value: unknown): Promise<void> {
  await db.run(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(value)],
  )
}

export async function deleteKey(db: Db, key: string): Promise<void> {
  await db.run('DELETE FROM kv WHERE key = ?', [key])
}
