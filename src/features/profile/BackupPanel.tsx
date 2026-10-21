import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { format, parseISO } from 'date-fns'
import { Download, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { exportBackup, importBackup } from '../../db/backup'
import { getDb } from '../../db/client'
import { getJson, setJson } from '../../db/repos/kv'
import { plural } from '../../lib/format'
import { useActiveWorkout } from '../../store/activeWorkout'

const LAST_BACKUP_KEY = 'lastBackupAt'

// Resolves true only if the file was handed to another app (or downloaded).
async function saveFile(filename: string, json: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
    return true
  }
  // Written to the app cache, then handed to the share sheet (Drive, Files, email…).
  const { uri } = await Filesystem.writeFile({ path: filename, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 })
  try {
    const { activityType } = await Share.share({ title: 'Workout backup', files: [uri] })
    return !!activityType
  } catch {
    return false // share sheet dismissed
  }
}

export function BackupPanel() {
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void getDb()
      .then((db) => getJson<string>(db, LAST_BACKUP_KEY))
      .then((v) => setLastBackup(v ?? null))
  }, [])

  const doExport = async () => {
    setBusy('export')
    setMessage(null)
    try {
      await useActiveWorkout.getState().flush()
      const db = await getDb()
      const backup = await exportBackup(db)
      const shared = await saveFile(`workout-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`, JSON.stringify(backup))
      if (!shared) return
      // Only once an app actually received the file.
      const now = new Date().toISOString()
      await setJson(db, LAST_BACKUP_KEY, now)
      setLastBackup(now)
    } catch (err) {
      // Dismissing the share sheet isn't a failure.
      if (!/cancel/i.test(String(err))) setMessage({ text: `Export failed: ${String(err)}`, error: true })
    } finally {
      setBusy(null)
    }
  }

  const doImport = async (file: File) => {
    setMessage(null)
    let data: unknown
    try {
      data = JSON.parse(await file.text())
    } catch {
      setMessage({ text: "That file isn't a valid backup.", error: true })
      return
    }
    if (!confirm('Restore this backup? Everything currently on this phone is replaced (your Strava connection is kept).'))
      return
    setBusy('import')
    try {
      const { workouts } = await importBackup(await getDb(), data)
      setMessage({ text: `Restored ${plural(workouts, 'workout')}. Reloading…` })
      // Every store reads from the database at start-up; simplest to start fresh.
      setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : String(err), error: true })
      setBusy(null)
    }
  }

  return (
    <section className="space-y-3 rounded-xl bg-surface p-4">
      <div>
        <p className="font-semibold">Backup</p>
        <p className="text-sm text-muted">
          {lastBackup ? `Last backup ${format(parseISO(lastBackup), 'd MMM yyyy, h:mm a')}` : 'Never backed up'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={busy !== null}
          onClick={() => void doExport()}
          className="flex items-center justify-center gap-2 rounded-lg bg-raised py-2.5 text-sm disabled:opacity-50"
        >
          <Upload size={16} /> {busy === 'export' ? 'Exporting…' : 'Export'}
        </button>
        <button
          disabled={busy !== null}
          onClick={() => fileInput.current?.click()}
          className="flex items-center justify-center gap-2 rounded-lg bg-raised py-2.5 text-sm disabled:opacity-50"
        >
          <Download size={16} /> {busy === 'import' ? 'Restoring…' : 'Restore'}
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void doImport(f)
        }}
      />
      {message && <p className={`text-sm ${message.error ? 'text-bad' : 'text-good'}`}>{message.text}</p>}
      <p className="text-xs text-subtle">
        Everything stays on this phone, so export now and then (e.g. to Google Drive). Backups don't include your Strava
        login.
      </p>
    </section>
  )
}
