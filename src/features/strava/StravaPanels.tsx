import { Capacitor } from '@capacitor/core'
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Upload } from 'lucide-react'
import { useEffect } from 'react'
import { useSettings } from '../../store/settings'
import { useStrava } from '../../store/strava'

const activityUrl = (id: number) => `https://www.strava.com/activities/${id}`

// Profile: connect / disconnect and the auto-upload switch.
export function StravaConnection() {
  const { auth, connecting, error, connect, disconnect } = useStrava()
  const { stravaAutoUpload, update } = useSettings()
  const native = Capacitor.isNativePlatform()

  return (
    <section className="space-y-3 rounded-xl bg-surface p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="font-semibold">Strava</p>
          <p className="text-sm text-muted">
            {auth ? `Connected as ${auth.athlete.firstname} ${auth.athlete.lastname}`.trim() : 'Not connected'}
          </p>
        </div>
        {auth ? (
          <button
            onClick={() => confirm('Disconnect Strava? Already-uploaded activities stay on Strava.') && void disconnect()}
            className="rounded-lg bg-raised px-3 py-2 text-sm text-bad"
          >
            Disconnect
          </button>
        ) : (
          <button
            disabled={!native || connecting}
            onClick={() => void connect()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {connecting ? 'Waiting…' : 'Connect'}
          </button>
        )}
      </div>
      {!native && !auth && <p className="text-xs text-subtle">Connect from the phone app.</p>}
      {error && <p className="text-sm text-bad">{error}</p>}
      {auth && (
        <label className="flex items-center justify-between border-t border-line pt-3 text-sm">
          <span className="text-fg-soft">Upload workouts automatically</span>
          <input
            type="checkbox"
            checked={stravaAutoUpload}
            onChange={(e) => void update({ stravaAutoUpload: e.target.checked })}
            className="size-5 accent-[var(--color-accent)]"
          />
        </label>
      )}
    </section>
  )
}

// Workout detail: upload state for one workout.
export function StravaWorkoutStatus({ workoutId }: { workoutId: number }) {
  const auth = useStrava((s) => s.auth)
  const sync = useStrava((s) => s.syncs[workoutId])
  const { loadSync, upload } = useStrava.getState()

  useEffect(() => {
    void loadSync(workoutId)
  }, [workoutId, loadSync])

  if (!auth && !sync) return null
  const busy = sync?.status === 'uploading' || sync?.status === 'processing'

  return (
    <section className="flex items-center gap-3 rounded-xl bg-surface p-3">
      <span className="flex-1 text-sm">
        {sync?.status === 'done' && (
          <span className="flex items-center gap-1.5 text-good">
            <CheckCircle2 size={16} /> On Strava
          </span>
        )}
        {busy && (
          <span className="flex items-center gap-1.5 text-fg-soft">
            <Loader2 size={16} className="animate-spin" />
            {sync.status === 'uploading' ? 'Uploading to Strava…' : 'Strava is processing…'}
          </span>
        )}
        {sync?.status === 'error' && <span className="text-bad">Upload failed: {sync.error}</span>}
        {!sync && <span className="text-muted">Not on Strava yet</span>}
      </span>

      {sync?.status === 'done' && sync.activityId && (
        <a
          href={activityUrl(sync.activityId)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 rounded-lg bg-raised px-3 py-2 text-sm"
        >
          View <ExternalLink size={14} />
        </a>
      )}
      {auth && !busy && sync?.status !== 'done' && (
        <button
          onClick={() => void upload(workoutId)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-black"
        >
          {sync?.status === 'error' ? <RefreshCw size={14} /> : <Upload size={14} />}
          {sync?.status === 'error' ? 'Retry' : 'Upload'}
        </button>
      )}
    </section>
  )
}
