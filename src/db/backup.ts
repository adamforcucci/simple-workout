import type { Db, SqlValue } from './types'

// Parents before children, so inserts satisfy foreign keys (deletes go in reverse).
const TABLES = [
  'profile',
  'body_metrics',
  'exercises',
  'routines',
  'routine_items',
  'workouts',
  'workout_exercises',
  'sets',
  'hr_samples',
  'strava_sync',
  'kv',
] as const

// Never written to a backup file: a shared/cloud copy mustn't carry Strava access.
const PRIVATE_KV_KEYS = ['stravaAuth']

// Stable file-format identifier; unchanged by the app's rename so old backups still restore.
const APP_ID = 'adams-gym'
const INSERT_CHUNK = 2000

export interface BackupTable {
  columns: string[]
  rows: SqlValue[][]
}

export interface Backup {
  app: typeof APP_ID
  schemaVersion: number
  exportedAt: string
  tables: Record<string, BackupTable>
}

async function schemaVersion(db: Db): Promise<number> {
  return (await db.get<{ version: number }>('SELECT version FROM schema_version'))?.version ?? 0
}

export async function exportBackup(db: Db): Promise<Backup> {
  const tables: Record<string, BackupTable> = {}
  for (const t of TABLES) {
    const where = t === 'kv' ? ` WHERE key NOT IN (${PRIVATE_KV_KEYS.map(() => '?').join(',')})` : ''
    const rows = await db.all<Record<string, SqlValue>>(`SELECT * FROM ${t}${where}`, t === 'kv' ? PRIVATE_KV_KEYS : [])
    const columns = rows.length ? Object.keys(rows[0]) : []
    tables[t] = { columns, rows: rows.map((r) => columns.map((c) => r[c])) }
  }
  return { app: APP_ID, schemaVersion: await schemaVersion(db), exportedAt: new Date().toISOString(), tables }
}

export class BackupError extends Error {}

function validate(data: unknown, currentVersion: number): Backup {
  const b = data as Partial<Backup> | null
  if (!b || b.app !== APP_ID || typeof b.tables !== 'object' || b.tables === null)
    throw new BackupError("This file isn't a Simple Workout backup.")
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion > currentVersion)
    throw new BackupError('This backup is from a newer version of the app. Update the app first.')
  for (const [name, t] of Object.entries(b.tables)) {
    if (!(TABLES as readonly string[]).includes(name)) throw new BackupError(`Unknown table "${name}" in backup.`)
    if (!Array.isArray(t.columns) || !Array.isArray(t.rows) || t.columns.some((c) => !/^[a-z_]+$/.test(c)))
      throw new BackupError(`Backup table "${name}" is malformed.`)
  }
  return b as Backup
}

// Replaces all local data with the backup's, atomically. The current Strava
// connection is kept (backups never contain it).
export async function importBackup(db: Db, data: unknown): Promise<{ workouts: number }> {
  const backup = validate(data, await schemaVersion(db))
  await db.tx(async () => {
    for (const t of [...TABLES].reverse()) {
      if (t === 'kv')
        await db.run(`DELETE FROM kv WHERE key NOT IN (${PRIVATE_KV_KEYS.map(() => '?').join(',')})`, PRIVATE_KV_KEYS)
      else await db.run(`DELETE FROM ${t}`)
    }
    for (const t of TABLES) {
      const table = backup.tables[t]
      if (!table?.rows.length) continue
      let rows = table.rows
      if (t === 'kv') rows = rows.filter((r) => !PRIVATE_KV_KEYS.includes(String(r[table.columns.indexOf('key')])))
      const sql = `INSERT INTO ${t} (${table.columns.join(', ')}) VALUES (${table.columns.map(() => '?').join(', ')})`
      for (let i = 0; i < rows.length; i += INSERT_CHUNK) await db.batch(sql, rows.slice(i, i + INSERT_CHUNK))
    }
  })
  return { workouts: backup.tables.workouts?.rows.length ?? 0 }
}
