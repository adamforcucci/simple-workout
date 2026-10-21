import initSqlJs from 'sql.js'
import type { Db, SqlValue } from './types'

// In-memory Db over sql.js, for tests.
export async function sqlJsDb(): Promise<Db> {
  const SQL = await initSqlJs()
  const raw = new SQL.Database()
  raw.run('PRAGMA foreign_keys = ON')
  let inTx = false

  const db: Db = {
    async all<T>(sql: string, params: SqlValue[] = []) {
      const stmt = raw.prepare(sql)
      stmt.bind(params)
      const rows: T[] = []
      while (stmt.step()) rows.push(stmt.getAsObject() as T)
      stmt.free()
      return rows
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      return (await db.all<T>(sql, params))[0]
    },
    async run(sql, params = []) {
      raw.run(sql, params)
      const lastId = raw.exec('SELECT last_insert_rowid()')[0].values[0][0] as number
      return { lastId, changes: raw.getRowsModified() }
    },
    async exec(sql) {
      raw.exec(sql)
    },
    async batch(sql, rows) {
      const stmt = raw.prepare(sql)
      for (const row of rows) stmt.run(row)
      stmt.free()
    },
    async tx(fn) {
      if (inTx) return fn()
      raw.run('BEGIN')
      inTx = true
      try {
        const result = await fn()
        raw.run('COMMIT')
        return result
      } catch (err) {
        raw.run('ROLLBACK')
        throw err
      } finally {
        inTx = false
      }
    },
  }
  return db
}
