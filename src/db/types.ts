export type SqlValue = string | number | null

// Minimal async SQLite surface the repos depend on. Implemented over the
// Capacitor plugin in the app and over sql.js in tests.
export interface Db {
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>
  get<T>(sql: string, params?: SqlValue[]): Promise<T | undefined>
  run(sql: string, params?: SqlValue[]): Promise<{ lastId: number; changes: number }>
  exec(sql: string): Promise<void>
  // Runs one statement for many parameter rows in a single native call.
  batch(sql: string, rows: SqlValue[][]): Promise<void>
  tx<T>(fn: () => Promise<T>): Promise<T>
}
