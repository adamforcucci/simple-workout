import { ArrowDown, ArrowLeftRight, ArrowUp, Link2, MoreVertical, Plus, Replace, Timer, Trash2, Unlink } from 'lucide-react'
import { useState } from 'react'
import { ExercisePicker } from '../../components/ExercisePicker'
import { Sheet } from '../../components/Sheet'
import { formatClock } from '../../lib/format'
import { suggestSet, useActiveWorkout, type DraftExercise } from '../../store/activeWorkout'
import { useSettings } from '../../store/settings'
import { SetRow } from './SetRow'
import { REST_PRESETS, SUPERSET_COLORS, type ReferenceMode } from './workoutUi'

interface Props {
  exercise: DraftExercise
  isFirst: boolean
  isLast: boolean
  // Whether the next exercise is already in this one's superset.
  linkedToNext: boolean
  onFocusExercise: (index: number) => void
}

export function ExerciseCard({ exercise: ex, isFirst, isLast, linkedToNext, onFocusExercise }: Props) {
  const unit = useSettings((s) => s.unit)
  const store = useActiveWorkout.getState() // actions only; stable, no subscription needed
  const [menu, setMenu] = useState(false)
  const [restMenu, setRestMenu] = useState(false)
  const [swapping, setSwapping] = useState(false)
  const [refMode, setRefMode] = useState<ReferenceMode>('previous')
  const toggleRef = () => setRefMode((m) => (m === 'previous' ? 'best' : 'previous'))

  let normalNumber = 0
  const headers =
    ex.tracking === 'duration'
      ? ['', 'Sec']
      : [ex.tracking === 'reps' ? `+${unit}` : unit, 'Reps']

  return (
    <section
      id={`ex-${ex.key}`}
      className={`border-l-4 bg-surface py-3 ${ex.supersetGroup ? SUPERSET_COLORS[(ex.supersetGroup - 1) % SUPERSET_COLORS.length] : 'border-transparent'}`}
    >
      <div className="flex items-start gap-2 px-3">
        <div className="flex-1">
          {ex.supersetGroup && <p className="text-xs font-medium tracking-wide text-muted uppercase">Superset</p>}
          <h2 className="font-semibold text-accent-ink">{ex.name}</h2>
        </div>
        <button onClick={() => setMenu(true)} aria-label="Exercise options" className="p-1 text-muted">
          <MoreVertical size={20} />
        </button>
      </div>

      <input
        value={ex.notes}
        onChange={(e) => store.setExerciseNotes(ex.key, e.target.value)}
        placeholder="Add notes"
        className="mx-3 mt-1 w-[calc(100%-1.5rem)] bg-transparent text-sm text-fg-soft outline-none placeholder:text-faint"
      />

      <button onClick={() => setRestMenu(true)} className="mx-3 mt-1 flex items-center gap-1 text-sm text-info">
        <Timer size={14} /> Rest: {ex.restS ? formatClock(ex.restS) : 'Off'}
      </button>

      <div className="mt-2 grid grid-cols-[2.25rem_1fr_4.5rem_4rem_2.5rem] gap-2 px-3 text-center text-xs font-medium text-subtle uppercase">
        <span>Set</span>
        <button onClick={toggleRef} className="flex items-center justify-center gap-1 uppercase" aria-label="Switch between previous and best">
          {refMode === 'best' ? 'Best' : 'Previous'} <ArrowLeftRight size={11} />
        </button>
        <span>{headers[0]}</span>
        <span>{headers[1]}</span>
        <span />
      </div>

      {ex.sets.map((s, i) => {
        if (s.type !== 'warmup') normalNumber++
        return (
          <SetRow
            key={s.key}
            set={s}
            number={normalNumber}
            tracking={ex.tracking}
            reference={refMode === 'best' ? (ex.best ?? undefined) : ex.previous[i]}
            referenceMode={refMode}
            onToggleReference={toggleRef}
            suggestion={suggestSet(ex, i)}
            unit={unit}
            onChange={(patch) => store.updateSet(ex.key, s.key, patch)}
            onRemove={() => store.removeSet(ex.key, s.key)}
            onToggle={() => {
              const result = store.toggleSet(ex.key, s.key)
              if (typeof result === 'number') onFocusExercise(result)
              return result !== false
            }}
          />
        )
      })}

      <button
        onClick={() => store.addSet(ex.key)}
        className="mx-3 mt-2 flex w-[calc(100%-1.5rem)] items-center justify-center gap-1 rounded-md bg-raised py-2 text-sm"
      >
        <Plus size={16} /> Add set
      </button>

      <Sheet
        open={menu}
        onClose={() => setMenu(false)}
        title={ex.name}
        actions={[
          ...(!isLast && !linkedToNext ? [{ label: 'Superset with next', icon: <Link2 size={18} />, onSelect: () => store.linkWithNext(ex.key) }] : []),
          ...(ex.supersetGroup
            ? [{ label: 'Remove from superset', icon: <Unlink size={18} />, onSelect: () => store.unlink(ex.key) }]
            : []),
          ...(!isFirst ? [{ label: 'Move up', icon: <ArrowUp size={18} />, onSelect: () => store.moveExercise(ex.key, -1) }] : []),
          ...(!isLast ? [{ label: 'Move down', icon: <ArrowDown size={18} />, onSelect: () => store.moveExercise(ex.key, 1) }] : []),
          {
            label: 'Swap exercise',
            icon: <Replace size={18} />,
            onSelect: () => {
              const done = ex.sets.some((s) => s.completedAt !== null)
              if (!done || confirm(`Swap ${ex.name}? Its completed sets will be cleared.`)) setSwapping(true)
            },
          },
          {
            label: 'Remove exercise',
            icon: <Trash2 size={18} />,
            destructive: true,
            onSelect: () => store.removeExercise(ex.key),
          },
        ]}
      />
      <Sheet
        open={restMenu}
        onClose={() => setRestMenu(false)}
        title="Rest timer"
        actions={REST_PRESETS.map((s) => ({
          label: s ? formatClock(s) : 'Off',
          onSelect: () => store.setRest(ex.key, s),
        }))}
      />
      <ExercisePicker
        open={swapping}
        single
        title={`Swap ${ex.name} for…`}
        onClose={() => setSwapping(false)}
        onSelect={([id]) => void store.swapExercise(ex.key, id)}
      />
    </section>
  )
}
