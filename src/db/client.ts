import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'
import { capacitorDb } from './capacitorDb'
import { migrate } from './migrations'
import { seedExercises } from './seed'
import type { Db } from './types'

const DB_NAME = 'gym'

let ready: Promise<Db> | undefined

export function getDb(): Promise<Db> {
  ready ??= open()
  return ready
}

async function open(): Promise<Db> {
  const sqlite = new SQLiteConnection(CapacitorSQLite)

  if (Capacitor.getPlatform() === 'web') {
    const { defineCustomElements } = await import('jeep-sqlite/loader')
    await defineCustomElements(window)
    if (!document.querySelector('jeep-sqlite')) {
      const el = document.createElement('jeep-sqlite')
      el.setAttribute('autoSave', 'false')
      document.body.appendChild(el)
    }
    await customElements.whenDefined('jeep-sqlite')
    await sqlite.initWebStore()
  }

  // If the WebView reloaded mid-transaction (e.g. `cap run` relaunching), the
  // native side still holds the old connection with the transaction open, and
  // it refuses to close it — the new open() then fails with "database is
  // locked". Roll it back first so the consistency check can close it.
  if (Capacitor.getPlatform() !== 'web') {
    try {
      if ((await CapacitorSQLite.isTransactionActive({ database: DB_NAME })).result) {
        await CapacitorSQLite.rollbackTransaction({ database: DB_NAME })
      }
    } catch {
      // No native connection left over — the normal case.
    }
  }

  await sqlite.checkConnectionsConsistency()
  const conn = (await sqlite.isConnection(DB_NAME, false)).result
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false)
  await conn.open()

  const db = capacitorDb(sqlite, conn, DB_NAME)
  await db.exec('PRAGMA foreign_keys = ON')
  await migrate(db)
  await seedExercises(db)
  return db
}
