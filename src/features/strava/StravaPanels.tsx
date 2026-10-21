import { Capacitor } from '@capacitor/core'
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { openLink, PRIVACY_URL } from '../../lib/links'
import { useSettings } from '../../store/settings'
import { useStrava } from '../../store/strava'

const activityUrl = (id: number) => `https://www.strava.com/activities/${id}`

// Shown before handing over to Strava: what's shared, and how to stop (API Agreement 2.1).
function StravaConsent({ onContinue, onCancel }: { onContinue: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onCancel}>
      <div
        className="space-y-3 rounded-t-2xl bg-surface p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Connect Strava</h2>
        <p className="text-sm text-fg-soft">When you save a workout (or tap Upload), the app sends it to your Strava account:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-fg-soft">
          <li>name, start time and duration</li>
          <li>exercises and sets (weight, reps or time)</li>
          <li>heart rate readings and estimated calories</li>
          <li>your notes and a written summary</li>
        </ul>
        <p className="text-sm text-fg-soft">
          The app receives your Strava name and a sign-in token, stored only on this phone. Disconnect any time here or
          in Strava&apos;s settings; the app then deletes its Strava sign-in. Activities already on Strava stay there
          until you delete them in Strava.
        </p>
        <button onClick={() => openLink(PRIVACY_URL)} className="text-sm text-accent-ink underline">
          Privacy Policy
        </button>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button onClick={onCancel} className="rounded-lg bg-raised py-3 font-medium">
            Cancel
          </button>
          <button onClick={onContinue} className="rounded-lg bg-accent py-3 font-semibold text-on-accent">
            Continue to Strava
          </button>
        </div>
      </div>
    </div>
  )
}

// Profile: connect / disconnect and the auto-upload switch.
export function StravaConnection() {
  const { auth, connecting, error, connect, disconnect } = useStrava()
  const [consent, setConsent] = useState(false)
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
            onClick={() => setConsent(true)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50"
          >
            {connecting ? 'Waiting…' : 'Connect'}
          </button>
        )}
      </div>
      {!native && !auth && <p className="text-xs text-subtle">Connect from the phone app.</p>}
      {consent && (
        <StravaConsent
          onCancel={() => setConsent(false)}
          onContinue={() => {
            setConsent(false)
            void connect()
          }}
        />
      )}
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
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-on-accent"
        >
          {sync?.status === 'error' ? <RefreshCw size={14} /> : <Upload size={14} />}
          {sync?.status === 'error' ? 'Retry' : 'Upload'}
        </button>
      )}
    </section>
  )
}
