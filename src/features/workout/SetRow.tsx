import { Check, Trash2, Trophy } from 'lucide-react'
import { useRef, useState, type TouchEvent } from 'react'
import { NumberField } from '../../components/NumberField'
import { Sheet } from '../../components/Sheet'
import type { LoggedSet, SetType } from '../../db/repos/workouts'
import type { Tracking } from '../../domain/exerciseCatalog'
import { fromDisplayWeight, toDisplayWeight, type WeightUnit } from '../../domain/units'
import type { DraftSet, SetSuggestion } from '../../store/activeWorkout'
import { formatPrevious, type ReferenceMode } from './workoutUi'

const TYPE_BADGE: Record<Exclude<SetType, 'normal'>, { text: string; className: string }> = {
  warmup: { text: 'W', className: 'text-warn' },
  drop: { text: 'D', className: 'text-special' },
  failure: { text: 'F', className: 'text-bad' },
}

// Swipe left this far to reveal the delete button (sized like the tick button).
const BIN_WIDTH = 56

interface Props {
  set: DraftSet
  number: number
  tracking: Tracking
  // Last session's matching set, or the best-ever set, per `referenceMode`.
  reference: LoggedSet | undefined
  referenceMode: ReferenceMode
  onToggleReference: () => void
  suggestion: SetSuggestion
  unit: WeightUnit
  onChange: (patch: Partial<LoggedSet>) => void
  onToggle: () => boolean
  onRemove: () => void
}

export function SetRow(props: Props) {
  const { set, number, tracking, reference, referenceMode, onToggleReference, suggestion, unit, onChange, onToggle, onRemove } =
    props
  const [menu, setMenu] = useState(false)
  const [shake, setShake] = useState(false)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const touch = useRef<{ x: number; y: number; base: number; swiping: boolean | null } | null>(null)
  const done = set.completedAt !== null
  const badge = set.type === 'normal' ? null : TYPE_BADGE[set.type]

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY, base: offset, swiping: null }
  }
  const onTouchMove = (e: TouchEvent) => {
    const s = touch.current
    if (!s) return
    const t = e.touches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    // Decide once per gesture whether it's a horizontal swipe or a scroll.
    if (s.swiping === null && Math.abs(dx) + Math.abs(dy) > 8) s.swiping = Math.abs(dx) > Math.abs(dy)
    if (s.swiping) {
      setDragging(true)
      setOffset(Math.min(0, Math.max(-BIN_WIDTH, s.base + dx)))
    }
  }
  const onTouchEnd = () => {
    if (touch.current?.swiping) setOffset((o) => (o < -BIN_WIDTH / 2 ? -BIN_WIDTH : 0))
    touch.current = null
    setDragging(false)
  }

  const weightPlaceholder = suggestion.weightKg ? String(toDisplayWeight(suggestion.weightKg, unit)) : tracking === 'reps' ? '0' : ''

  return (
    <div className="relative overflow-hidden" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="absolute inset-y-0 right-0 flex items-center justify-center pr-3" style={{ width: BIN_WIDTH }}>
        <button
          onClick={() => {
            setOffset(0)
            onRemove()
          }}
          aria-label="Delete set"
          tabIndex={offset ? 0 : -1}
          className="flex h-8 w-10 items-center justify-center rounded-md bg-red-600 text-white"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div
        className="bg-surface transition-transform duration-150"
        style={{ transform: `translateX(${offset}px)`, transitionDuration: dragging ? '0ms' : undefined }}
        onClickCapture={(e) => {
          // A tap on an open row closes it rather than editing.
          if (offset) {
            e.stopPropagation()
            setOffset(0)
          }
        }}
      >
        <div
          className={`grid grid-cols-[2.25rem_1fr_4.5rem_4rem_2.5rem] items-center gap-2 px-3 py-1 ${done ? 'bg-good-soft' : ''} ${shake ? 'animate-[shake_0.3s]' : ''}`}
        >
          <button onClick={() => setMenu(true)} className={`py-1.5 text-center font-semibold ${badge?.className ?? ''}`}>
            {badge?.text ?? number}
          </button>
          <button
            onClick={onToggleReference}
            aria-label={referenceMode === 'best' ? 'Showing best set; show previous' : 'Showing previous; show best set'}
            className={`flex items-center justify-center gap-1 truncate text-sm ${referenceMode === 'best' ? 'text-accent-ink' : 'text-subtle'}`}
          >
            {referenceMode === 'best' && reference && <Trophy size={12} className="shrink-0" />}
            {formatPrevious(reference, tracking, unit)}
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
        </div>
      </div>

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
