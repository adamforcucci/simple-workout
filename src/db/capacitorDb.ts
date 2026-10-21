import { Capacitor } from '@capacitor/core'
import type { SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite'
import type { Db, SqlValue } from './types'

const WEB_SAVE_DELAY_MS = 300

// Db over @capacitor-community/sqlite. On web (jeep-sqlite) the database lives
// in memory and is flushed to IndexedDB after writes.
export function capacitorDb(sqlite: SQLiteConnection, conn: SQLiteDBConnection, name: string): Db {
  const isWeb = Capacitor.getPlatform() === 'web'
  let inTx = false
  let saveTimer: ReturnType<typeof setTimeout> | undefined

  const scheduleSave = () => {
    if (!isWeb || inTx) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void sqlite.saveToStore(name), WEB_SAVE_DELAY_MS)
  }

  const db: Db = {
    async all<T>(sql: string, params: SqlValue[] = []) {
      const res = await conn.query(sql, params)
      return (res.values ?? []) as T[]
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      const rows = await db.all<T>(sql, params)
      return rows[0]
    },
    async run(sql, params = []) {
      const res = await conn.run(sql, params, !inTx)
      scheduleSave()
      return { lastId: res.changes?.lastId ?? 0, changes: res.changes?.changes ?? 0 }
    },
    async exec(sql) {
      await conn.execute(sql, !inTx)
      scheduleSave()
    },
    async batch(sql, rows) {
      if (rows.length === 0) return
      await conn.executeSet([{ statement: sql, values: rows }], !inTx)
      scheduleSave()
    },
    async tx(fn) {
      if (inTx) return fn()
      await conn.beginTransaction()
      inTx = true
      try {
        const result = await fn()
        await conn.commitTransaction()
        return result
      } catch (err) {
        await conn.rollbackTransaction()
        throw err
      } finally {
        inTx = false
        scheduleSave()
      }
    },
  }
  return db
}
