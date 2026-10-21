import { Check } from 'lucide-react'
import { useState } from 'react'
import { NumberField } from '../../components/NumberField'
import { Sheet } from '../../components/Sheet'
import type { LoggedSet, SetType } from '../../db/repos/workouts'
import type { Tracking } from '../../domain/exerciseCatalog'
import { fromDisplayWeight, toDisplayWeight, type WeightUnit } from '../../domain/units'
import type { DraftSet, SetSuggestion } from '../../store/activeWorkout'
import { formatPrevious } from './workoutUi'

const TYPE_BADGE: Record<Exclude<SetType, 'normal'>, { text: string; className: string }> = {
  warmup: { text: 'W', className: 'text-warn' },
  drop: { text: 'D', className: 'text-special' },
  failure: { text: 'F', className: 'text-bad' },
}

interface Props {
  set: DraftSet
  number: number
  tracking: Tracking
  previous: LoggedSet | undefined
  suggestion: SetSuggestion
  unit: WeightUnit
  onChange: (patch: Partial<LoggedSet>) => void
  onToggle: () => boolean
  onRemove: () => void
}

export function SetRow({ set, number, tracking, previous, suggestion, unit, onChange, onToggle, onRemove }: Props) {
  const [menu, setMenu] = useState(false)
  const [shake, setShake] = useState(false)
  const done = set.completedAt !== null
  const badge = set.type === 'normal' ? null : TYPE_BADGE[set.type]

  const copyPrevious = () => {
    if (!previous || done) return
    onChange({ weightKg: previous.weightKg, reps: previous.reps, durationS: previous.durationS })
  }

  const weightPlaceholder = suggestion.weightKg ? String(toDisplayWeight(suggestion.weightKg, unit)) : tracking === 'reps' ? '0' : ''

  return (
    <div
      className={`grid grid-cols-[2.25rem_1fr_4.5rem_4rem_2.5rem] items-center gap-2 px-3 py-1 ${done ? 'bg-good-soft' : ''} ${shake ? 'animate-[shake_0.3s]' : ''}`}
    >
      <button onClick={() => setMenu(true)} className={`py-1.5 text-center font-semibold ${badge?.className ?? ''}`}>
        {badge?.text ?? number}
      </button>
      <button onClick={copyPrevious} className="truncate text-center text-sm text-subtle">
        {formatPrevious(previous, tracking, unit)}
      </button>

      {tracking === 'duration' ? (
        <>
          <span />
          <NumberField
            aria-label="Seconds"
            value={set.durationS}
            placeholder={suggestion.durationS ? String(suggestion.durationS) : 's'}
            onChange={(v) => onChange({ durationS: v })}
          />
        </>
      ) : (
        <>
          <NumberField
            aria-label={`Weight (${unit})`}
            decimal
            value={set.weightKg === null ? null : toDisplayWeight(set.weightKg, unit)}
            placeholder={weightPlaceholder}
            onChange={(v) => onChange({ weightKg: v === null ? null : fromDisplayWeight(v, unit) })}
          />
          <NumberField
            aria-label="Reps"
            value={set.reps}
            placeholder={String(suggestion.reps ?? '')}
            onChange={(v) => onChange({ reps: v })}
          />
        </>
      )}

      <button
        aria-label={done ? 'Mark set incomplete' : 'Complete set'}
        onClick={() => {
          if (!onToggle()) {
            setShake(true)
            setTimeout(() => setShake(false), 300)
          }
        }}
        className={`flex h-8 items-center justify-center rounded-md ${done ? 'bg-emerald-500 text-black' : 'bg-raised text-muted'}`}
      >
        <Check size={18} />
      </button>

      <Sheet
        open={menu}
        onClose={() => setMenu(false)}
        title="Set type"
        actions={[
          { label: 'Warm-up', onSelect: () => onChange({ type: 'warmup' }) },
          { label: 'Normal', onSelect: () => onChange({ type: 'normal' }) },
          { label: 'Drop set', onSelect: () => onChange({ type: 'drop' }) },
          { label: 'Failure', onSelect: () => onChange({ type: 'failure' }) },
          { label: 'Delete set', destructive: true, onSelect: onRemove },
        ]}
      />
    </div>
  )
}
