import { format, parseISO } from 'date-fns'
import { ChevronRight, Dumbbell, Heart, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ChartCard, TrendChart } from '../../components/charts'
import { NumberField } from '../../components/NumberField'
import type { Profile, Sex } from '../../db/repos/profile'
import { ageOn } from '../../domain/calories'
import { fromDisplayWeight, toDisplayWeight, type WeightUnit } from '../../domain/units'
import { applyTheme, type ThemePref } from '../../lib/theme'
import { useHeartRate } from '../../store/heartRate'
import { useProfile } from '../../store/profile'
import { useSettings } from '../../store/settings'
import { StravaConnection } from '../strava/StravaPanels'
import { BackupPanel } from './BackupPanel'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-4 border-t border-line py-2.5 first:border-t-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="w-40">{children}</span>
    </label>
  )
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T | null
  onChange: (v: T) => void
}) {
  return (
    <span className="flex rounded-md bg-raised p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded px-2 py-1 text-sm ${value === o.value ? 'bg-selected text-fg shadow-sm' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </span>
  )
}

function ProfileForm({ profile }: { profile: Profile }) {
  const save = useProfile((s) => s.save)
  const update = (patch: Partial<Profile>) => void save({ ...profile, ...patch })
  const [now] = useState(() => new Date())
  const age = profile.dob ? ageOn(profile.dob, now) : null

  return (
    <section className="rounded-xl bg-surface px-4 py-1.5">
      <Field label="Name">
        <input
          defaultValue={profile.name}
          onBlur={(e) => e.target.value !== profile.name && update({ name: e.target.value })}
          className="w-full rounded-md bg-raised px-2 py-1.5 text-right outline-none"
        />
      </Field>
      <Field label="Date of birth">
        <input
          type="date"
          value={profile.dob ?? ''}
          max={format(now, 'yyyy-MM-dd')}
          onChange={(e) => update({ dob: e.target.value || null })}
          className="w-full rounded-md bg-raised px-2 py-1.5 text-right outline-none"
        />
      </Field>
      <Field label="Sex">
        <Segmented<Sex>
          options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
          ]}
          value={profile.sex}
          onChange={(sex) => update({ sex })}
        />
      </Field>
      <Field label="Height (cm)">
        <NumberField value={profile.heightCm} onChange={(heightCm) => update({ heightCm })} decimal />
      </Field>
      <Field label="Max heart rate">
        <NumberField
          value={profile.maxHrOverride}
          placeholder={age !== null ? String(220 - age) : 'bpm'}
          onChange={(maxHrOverride) => update({ maxHrOverride })}
        />
      </Field>
      <p className="pb-2 text-xs text-subtle">
        Age, sex and body weight are used to estimate calories from heart rate. Max heart rate defaults to 220 − age.
      </p>
    </section>
  )
}

function BodyWeight({ unit }: { unit: WeightUnit }) {
  const { bodyMetrics, logWeight, deleteMetric } = useProfile()
  const [today] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [date, setDate] = useState(today)
  const [value, setValue] = useState<number | null>(null)
  const weights = bodyMetrics.filter((m) => m.weightKg !== null)
  const points = weights.map((m) => ({ label: format(parseISO(m.date), 'd MMM'), value: toDisplayWeight(m.weightKg!, unit) }))
  const latest = weights.at(-1)

  return (
    <div className="space-y-3">
      <section className="rounded-xl bg-surface p-4">
        <h3 className="mb-3 font-semibold">Log body weight</h3>
        <div className="grid grid-cols-[1fr_6rem_auto] gap-2">
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value || today)}
            className="rounded-md bg-raised px-2 py-1.5 outline-none"
          />
          <NumberField value={value} onChange={setValue} decimal placeholder={unit} aria-label={`Body weight (${unit})`} />
          <button
            disabled={value === null}
            onClick={() => {
              if (value === null) return
              void logWeight(date, fromDisplayWeight(value, unit))
              setValue(null)
            }}
            className="rounded-md bg-accent px-4 font-semibold text-on-accent disabled:opacity-40"
          >
            Log
          </button>
        </div>
      </section>

      {points.length >= 2 && (
        <ChartCard
          title="Body weight"
          subtitle={latest ? `Latest ${toDisplayWeight(latest.weightKg!, unit)} ${unit} · ${format(parseISO(latest.date), 'd MMM')}` : undefined}
          data={points}
          formatValue={(v) => `${v} ${unit}`}
        >
          <TrendChart data={points} formatValue={(v) => `${v} ${unit}`} />
        </ChartCard>
      )}

      {weights.length > 0 && (
        <ul className="rounded-xl bg-surface px-4">
          {weights
            .slice(-8)
            .reverse()
            .map((m) => (
              <li key={m.id} className="flex items-center gap-3 border-t border-line py-2.5 text-sm first:border-t-0">
                <span className="flex-1 text-muted">{format(parseISO(m.date), 'EEE d MMM yyyy')}</span>
                <span className="tabular-nums">
                  {toDisplayWeight(m.weightKg!, unit)} {unit}
                </span>
                <button onClick={() => void deleteMetric(m.id)} aria-label="Delete entry" className="p-1 text-subtle">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

function HeartRateRow() {
  const device = useHeartRate((s) => s.device)
  return (
    <Link to="/settings/heart-rate" className="flex items-center gap-3 rounded-xl bg-surface p-4">
      <Heart size={18} className="text-red-500" />
      <span className="flex-1">
        <span className="block">Heart rate monitor</span>
        <span className="text-sm text-muted">{device ? device.name : 'Not paired'}</span>
      </span>
      <ChevronRight size={18} className="text-faint" />
    </Link>
  )
}

export function ProfilePage() {
  const { profile, load } = useProfile()
  const { unit, restSound, theme, update } = useSettings()

  useEffect(() => {
    void load()
  }, [load])

  if (!profile) return null

  return (
    <div className="space-y-5 p-4">
      <h1 className="text-2xl font-semibold">{profile.name || 'Profile'}</h1>
      <ProfileForm profile={profile} />
      <BodyWeight unit={unit} />

      <section className="space-y-1">
        <h2 className="text-sm font-medium text-muted">Settings</h2>
        <div className="rounded-xl bg-surface px-4 py-1.5">
          <Field label="Theme">
            <Segmented<ThemePref>
              options={[
                { value: 'system', label: 'Phone' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              value={theme}
              onChange={(t) => {
                applyTheme(t)
                void update({ theme: t })
              }}
            />
          </Field>
          <Field label="Weight unit">
            <Segmented<WeightUnit>
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' },
              ]}
              value={unit}
              onChange={(u) => void update({ unit: u })}
            />
          </Field>
          <Field label="Rest timer sound">
            <Segmented<'on' | 'off'>
              options={[
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
              ]}
              value={restSound ? 'on' : 'off'}
              onChange={(v) => void update({ restSound: v === 'on' })}
            />
          </Field>
        </div>
      </section>

      <HeartRateRow />
      <StravaConnection />
      <BackupPanel />

      <Link to="/exercises" className="flex items-center gap-3 rounded-xl bg-surface p-4">
        <Dumbbell size={18} className="text-accent-ink" />
        <span className="flex-1">Exercise library</span>
        <ChevronRight size={18} className="text-faint" />
      </Link>
    </div>
  )
}
