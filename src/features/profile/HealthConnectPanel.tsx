import { Capacitor } from '@capacitor/core'
import { useEffect } from 'react'
import { HealthConnect } from '../../native/healthConnect'
import { useHealthConnect } from '../../store/healthConnect'
import { useSettings } from '../../store/settings'

// Profile: opt-in copy of finished workouts into Android's Health Connect.
export function HealthConnectPanel() {
  const { availability, granted, error, backfill, load, enable, disable, saveAll } = useHealthConnect()
  const enabled = useSettings((s) => s.healthConnect)
  const on = enabled && granted

  useEffect(() => {
    void load()
  }, [load])

  const status =
    availability === null
      ? 'Checking…'
      : availability === 'unavailable'
        ? Capacitor.isNativePlatform()
          ? 'Not available on this phone'
          : 'Available in the phone app'
        : availability === 'update_required'
          ? 'Health Connect needs installing or updating'
          : on
            ? 'Saving workouts to Health Connect'
            : enabled
              ? 'Access was turned off in Health Connect'
              : 'Off'

  return (
    <section className="space-y-3 rounded-xl bg-surface p-4">
      <div>
        <p className="font-semibold">Health Connect</p>
        <p className="text-sm text-muted">{status}</p>
      </div>

      {availability === 'update_required' && (
        <button onClick={() => void HealthConnect.openStore()} className="rounded-lg bg-raised px-3 py-2 text-sm font-medium">
          Get Health Connect
        </button>
      )}

      {availability === 'available' && (
        <>
          <p className="text-sm text-fg-soft">
            Each finished workout is shared as an exercise session with its sets, heart rate and calories, so apps like
            Google Fit or Fitbit can see it. Nothing is read back.
          </p>
          <label className="flex items-center justify-between border-t border-line pt-3 text-sm">
            <span className="text-fg-soft">Save workouts to Health Connect</span>
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => void (e.target.checked ? enable() : disable())}
              className="size-5 accent-[var(--color-accent)]"
            />
          </label>
          {on && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void saveAll()}
                disabled={!!backfill}
                className="rounded-lg bg-raised px-3 py-2 text-sm font-medium disabled:opacity-60"
              >
                {backfill ? `Adding ${backfill.done} of ${backfill.total}…` : 'Add past workouts'}
              </button>
              <button
                onClick={() => void HealthConnect.openSettings()}
                className="rounded-lg bg-raised px-3 py-2 text-sm font-medium"
              >
                Manage in Health Connect
              </button>
            </div>
          )}
        </>
      )}

      {error && <p className="text-sm text-bad">{error}</p>}
    </section>
  )
}
