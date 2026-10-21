import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  GripVertical,
  Link2,
  Minus,
  MoreVertical,
  Plus,
  Replace,
  Trash2,
  Unlink,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ExercisePicker } from '../../components/ExercisePicker'
import { NumberField } from '../../components/NumberField'
import { Sheet, type SheetAction } from '../../components/Sheet'
import { getDb } from '../../db/client'
import { getExercises, type Exercise } from '../../db/repos/exercises'
import { deleteRoutine, getRoutine, saveRoutine, type RoutineItem } from '../../db/repos/routines'
import type { Tracking } from '../../domain/exerciseCatalog'
import { linkWithNext, moveItem, moveUnitTo, normalizeSupersets, units, unlink } from '../../domain/superset'
import { fromDisplayWeight, toDisplayWeight } from '../../domain/units'
import { formatClock } from '../../lib/format'
import { useSettings } from '../../store/settings'
import { REST_PRESETS, SUPERSET_COLORS } from '../workout/workoutUi'

interface EditorItem extends RoutineItem {
  key: string
  name: string
  tracking: Tracking
  defaultRestS: number
}

let keySeq = 0
const nextKey = () => `item-${++keySeq}`

const restLabel = (s: number) => (s ? formatClock(s) : 'Off')

function fromExercise(e: Exercise, keep: Partial<EditorItem> = {}): EditorItem {
  return {
    key: nextKey(),
    exerciseId: e.id,
    name: e.name,
    tracking: e.tracking,
    defaultRestS: e.defaultRestS,
    supersetGroup: null,
    targetSets: 3,
    targetReps: e.tracking === 'duration' ? null : 10,
    targetWeightKg: null,
    targetDurationS: null,
    restS: null,
    ...keep,
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1">{label}</p>
      {children}
    </div>
  )
}

// One draggable block: a single exercise, or a whole superset (dragged as one).
function SortableUnit({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const handle = (
    <button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      className="flex w-7 shrink-0 touch-none items-center justify-center text-faint"
    >
      <GripVertical size={20} />
    </button>
  )
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`space-y-px ${isDragging ? 'relative z-10 opacity-90 shadow-lg' : ''}`}
    >
      {children(handle)}
    </div>
  )
}

export function RoutineEditor() {
  const { id } = useParams()
  const routineId = id === undefined || id === 'new' ? undefined : Number(id)
  const navigate = useNavigate()
  const unit = useSettings((s) => s.unit)
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<EditorItem[]>([])
  const [loaded, setLoaded] = useState(routineId === undefined)
  const [picking, setPicking] = useState(false)
  const [swapFor, setSwapFor] = useState<number | null>(null)
  const [menuFor, setMenuFor] = useState<number | null>(null)
  const [restFor, setRestFor] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (routineId === undefined) return
    void (async () => {
      const db = await getDb()
      const r = await getRoutine(db, routineId)
      if (!r) return navigate('/', { replace: true })
      const exercises = await getExercises(
        db,
        r.items.map((i) => i.exerciseId),
      )
      setName(r.name)
      setNotes(r.notes)
      setItems(
        r.items.flatMap((i) => {
          const e = exercises.get(i.exerciseId)
          return e ? [fromExercise(e, { ...i, key: nextKey() })] : []
        }),
      )
      setLoaded(true)
    })()
  }, [routineId, navigate])

  const patch = (index: number, p: Partial<EditorItem>) =>
    setItems((xs) => xs.map((x, i) => (i === index ? { ...x, ...p } : x)))

  const addExercises = async (ids: number[], asSuperset: boolean) => {
    const exercises = await getExercises(await getDb(), ids)
    setItems((xs) => {
      const group = asSuperset && ids.length > 1 ? Math.max(0, ...xs.map((x) => x.supersetGroup ?? 0)) + 1 : null
      const added = ids.flatMap((id) => {
        const e = exercises.get(id)
        return e ? [fromExercise(e, { supersetGroup: group })] : []
      })
      return normalizeSupersets([...xs, ...added])
    })
  }

  // Same slot, superset, sets, reps and rest; the old exercise's weight doesn't carry over.
  const swap = async (index: number, exerciseId: number) => {
    const e = (await getExercises(await getDb(), [exerciseId])).get(exerciseId)
    if (!e) return
    setItems((xs) =>
      xs.map((x, i) =>
        i === index
          ? fromExercise(e, {
              supersetGroup: x.supersetGroup,
              targetSets: x.targetSets,
              targetReps: e.tracking === 'duration' ? null : x.targetReps,
              restS: x.restS,
            })
          : x,
      ),
    )
  }

  const save = async () => {
    await saveRoutine(await getDb(), {
      id: routineId,
      name: name.trim() || 'Untitled routine',
      notes,
      items: items.map((i) => ({
        exerciseId: i.exerciseId,
        supersetGroup: i.supersetGroup,
        targetSets: i.targetSets,
        targetReps: i.tracking === 'duration' ? null : i.targetReps,
        targetWeightKg: i.tracking === 'duration' ? null : i.targetWeightKg,
        targetDurationS: i.tracking === 'duration' ? i.targetDurationS : null,
        restS: i.restS,
      })),
    })
    navigate('/', { replace: true })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setItems((xs) => {
      const us = units(xs)
      const from = xs.findIndex((x) => x.key === active.id)
      const to = us.findIndex((u) => xs[u[0]].key === over.id)
      return from < 0 || to < 0 ? xs : moveUnitTo(xs, from, to)
    })
  }

  const menuActions = (i: number): SheetAction[] => [
    { label: 'Swap exercise', icon: <Replace size={18} />, onSelect: () => setSwapFor(i) },
    ...(i < items.length - 1 && !(items[i].supersetGroup !== null && items[i + 1].supersetGroup === items[i].supersetGroup)
      ? [{ label: 'Superset with next', icon: <Link2 size={18} />, onSelect: () => setItems((xs) => linkWithNext(xs, i)) }]
      : []),
    ...(items[i]?.supersetGroup
      ? [{ label: 'Remove from superset', icon: <Unlink size={18} />, onSelect: () => setItems((xs) => unlink(xs, i)) }]
      : []),
    ...(i > 0 ? [{ label: 'Move up', icon: <ArrowUp size={18} />, onSelect: () => setItems((xs) => moveItem(xs, i, -1)) }] : []),
    ...(i < items.length - 1
      ? [{ label: 'Move down', icon: <ArrowDown size={18} />, onSelect: () => setItems((xs) => moveItem(xs, i, 1)) }]
      : []),
    {
      label: 'Remove',
      icon: <Trash2 size={18} />,
      destructive: true,
      onSelect: () => setItems((xs) => normalizeSupersets(unlink(xs, i).filter((_, k) => k !== i))),
    },
  ]

  if (!loaded) return null

  const renderItem = (item: EditorItem, i: number, handle: ReactNode | null) => (
    <section
      key={item.key}
      className={`border-l-4 bg-surface px-3 py-3 ${item.supersetGroup ? SUPERSET_COLORS[(item.supersetGroup - 1) % SUPERSET_COLORS.length] : 'border-transparent'}`}
    >
      {item.supersetGroup && <p className="pl-8 text-xs font-medium tracking-wide text-muted uppercase">Superset</p>}
      {/* Handle, title and menu share one centred row. */}
      <div className="flex items-center gap-1">
        {handle ?? <span className="w-7 shrink-0" />}
        <h2 className="min-w-0 flex-1 font-semibold text-accent-ink">{item.name}</h2>
        <button onClick={() => setMenuFor(i)} aria-label="Exercise options" className="p-1 text-muted">
          <MoreVertical size={20} />
        </button>
      </div>
      <div
        className={`mt-3 grid items-start gap-2 text-xs text-muted ${item.tracking === 'duration' ? 'grid-cols-[1.5fr_1fr_1fr]' : 'grid-cols-[1.5fr_1fr_1fr_1fr]'}`}
      >
        <Field label="Sets">
          {/* Same height as the number fields beside it; full-height tap targets. */}
          <div className="flex h-9 items-stretch rounded-md bg-raised text-fg">
            <button
              aria-label="Fewer sets"
              onClick={() => patch(i, { targetSets: Math.max(1, item.targetSets - 1) })}
              className="flex w-9 items-center justify-center rounded-l-md active:bg-selected"
            >
              <Minus size={16} />
            </button>
            <span className="flex flex-1 items-center justify-center text-base tabular-nums">{item.targetSets}</span>
            <button
              aria-label="More sets"
              onClick={() => patch(i, { targetSets: item.targetSets + 1 })}
              className="flex w-9 items-center justify-center rounded-r-md active:bg-selected"
            >
              <Plus size={16} />
            </button>
          </div>
        </Field>
        {item.tracking === 'duration' ? (
          <Field label="Time (s)">
            <NumberField value={item.targetDurationS} placeholder="–" onChange={(v) => patch(i, { targetDurationS: v })} />
          </Field>
        ) : (
          <>
            <Field label={item.tracking === 'reps' ? `+${unit}` : unit}>
              <NumberField
                decimal
                value={item.targetWeightKg === null ? null : toDisplayWeight(item.targetWeightKg, unit)}
                placeholder="–"
                onChange={(v) => patch(i, { targetWeightKg: v === null ? null : fromDisplayWeight(v, unit) })}
              />
            </Field>
            <Field label="Reps">
              <NumberField value={item.targetReps} placeholder="–" onChange={(v) => patch(i, { targetReps: v })} />
            </Field>
          </>
        )}
        <Field label="Rest">
          <button onClick={() => setRestFor(i)} className="h-9 w-full rounded-md bg-raised text-base text-info">
            {restLabel(item.restS ?? item.defaultRestS)}
          </button>
        </Field>
      </div>
    </section>
  )

  const blocks = units(items)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-line px-3 py-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-1 text-muted">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 font-semibold">{routineId === undefined ? 'New routine' : 'Edit routine'}</h1>
        <button onClick={save} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent">
          Save
        </button>
      </header>

      <main className="flex-1 space-y-3 overflow-y-auto pb-6">
        <div className="space-y-2 p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Routine name"
            className="w-full rounded-lg bg-surface px-3 py-3 text-lg font-semibold outline-none placeholder:text-faint"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            className="w-full rounded-lg bg-surface px-3 py-2 text-sm outline-none placeholder:text-faint"
          />
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={blocks.map((u) => items[u[0]].key)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {blocks.map((u) => (
                <SortableUnit key={items[u[0]].key} id={items[u[0]].key}>
                  {(handle) => u.map((i, k) => renderItem(items[i], i, k === 0 ? handle : null))}
                </SortableUnit>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="space-y-3 px-3 pt-2">
          <button
            onClick={() => setPicking(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent/15 py-3 font-medium text-accent-ink"
          >
            <Plus size={18} /> Add exercises
          </button>
          {routineId !== undefined && (
            <button
              onClick={async () => {
                if (!confirm(`Delete "${name}"? Past workouts are kept.`)) return
                await deleteRoutine(await getDb(), routineId)
                navigate('/', { replace: true })
              }}
              className="w-full py-3 text-sm text-bad"
            >
              Delete routine
            </button>
          )}
        </div>
      </main>

      <Sheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor !== null ? items[menuFor]?.name : undefined}
        actions={menuFor !== null ? menuActions(menuFor) : []}
      />
      <Sheet
        open={restFor !== null}
        onClose={() => setRestFor(null)}
        title="Rest timer"
        actions={REST_PRESETS.map((s) => ({
          label: restLabel(s),
          onSelect: () => restFor !== null && patch(restFor, { restS: s }),
        }))}
      />
      <ExercisePicker open={picking} onClose={() => setPicking(false)} onSelect={(ids, ss) => void addExercises(ids, ss)} />
      <ExercisePicker
        open={swapFor !== null}
        single
        title={swapFor !== null ? `Swap ${items[swapFor]?.name} for…` : undefined}
        onClose={() => setSwapFor(null)}
        onSelect={([id]) => swapFor !== null && void swap(swapFor, id)}
      />
    </div>
  )
}
