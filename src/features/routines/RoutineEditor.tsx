import { ArrowDown, ArrowUp, ChevronLeft, Link2, Minus, MoreVertical, Plus, Trash2, Unlink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ExercisePicker } from '../../components/ExercisePicker'
import { NumberField } from '../../components/NumberField'
import { Sheet, type SheetAction } from '../../components/Sheet'
import { getDb } from '../../db/client'
import { getExercises } from '../../db/repos/exercises'
import { deleteRoutine, getRoutine, saveRoutine, type RoutineItem } from '../../db/repos/routines'
import { linkWithNext, moveItem, normalizeSupersets, unlink } from '../../domain/superset'
import { formatClock } from '../../lib/format'
import { REST_PRESETS, SUPERSET_COLORS } from '../workout/workoutUi'

interface EditorItem extends RoutineItem {
  key: string
  name: string
  defaultRestS: number
}

let keySeq = 0
const nextKey = () => `item-${++keySeq}`

export function RoutineEditor() {
  const { id } = useParams()
  const routineId = id === undefined || id === 'new' ? undefined : Number(id)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<EditorItem[]>([])
  const [loaded, setLoaded] = useState(routineId === undefined)
  const [picking, setPicking] = useState(false)
  const [menuFor, setMenuFor] = useState<number | null>(null)
  const [restFor, setRestFor] = useState<number | null>(null)

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
        r.items.map((i) => {
          const e = exercises.get(i.exerciseId)
          return { ...i, key: nextKey(), name: e?.name ?? 'Unknown', defaultRestS: e?.defaultRestS ?? 90 }
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
        if (!e) return []
        return [
          {
            key: nextKey(),
            exerciseId: id,
            name: e.name,
            defaultRestS: e.defaultRestS,
            supersetGroup: group,
            targetSets: 3,
            targetReps: e.tracking === 'duration' ? null : 10,
            restS: null,
          },
        ]
      })
      return normalizeSupersets([...xs, ...added])
    })
  }

  const save = async () => {
    const db = await getDb()
    await saveRoutine(db, {
      id: routineId,
      name: name.trim() || 'Untitled routine',
      notes,
      items: items.map(({ exerciseId, supersetGroup, targetSets, targetReps, restS }) => ({
        exerciseId,
        supersetGroup,
        targetSets,
        targetReps,
        restS,
      })),
    })
    navigate('/', { replace: true })
  }

  const menuActions = (i: number): SheetAction[] => [
    ...(i < items.length - 1
      ? [{ label: 'Superset with next', icon: <Link2 size={18} />, onSelect: () => setItems((xs) => linkWithNext(xs, i)) }]
      : []),
    ...(items[i]?.supersetGroup
      ? [{ label: 'Remove from superset', icon: <Unlink size={18} />, onSelect: () => setItems((xs) => unlink(xs, i)) }]
      : []),
    ...(i > 0 ? [{ label: 'Move up', icon: <ArrowUp size={18} />, onSelect: () => setItems((xs) => moveItem(xs, i, i - 1)) }] : []),
    ...(i < items.length - 1
      ? [{ label: 'Move down', icon: <ArrowDown size={18} />, onSelect: () => setItems((xs) => moveItem(xs, i, i + 1)) }]
      : []),
    {
      label: 'Remove',
      icon: <Trash2 size={18} />,
      destructive: true,
      onSelect: () => setItems((xs) => normalizeSupersets(unlink(xs, i).filter((_, k) => k !== i))),
    },
  ]

  if (!loaded) return null

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-line px-3 py-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-1 text-muted">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 font-semibold">{routineId === undefined ? 'New routine' : 'Edit routine'}</h1>
        <button onClick={save} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">
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

        {items.map((item, i) => (
          <section
            key={item.key}
            className={`border-l-4 bg-surface px-3 py-3 ${item.supersetGroup ? SUPERSET_COLORS[(item.supersetGroup - 1) % SUPERSET_COLORS.length] : 'border-transparent'}`}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1">
                {item.supersetGroup && <p className="text-xs font-medium tracking-wide text-muted uppercase">Superset</p>}
                <h2 className="font-semibold text-accent-ink">{item.name}</h2>
              </div>
              <button onClick={() => setMenuFor(i)} aria-label="Exercise options" className="p-1 text-muted">
                <MoreVertical size={20} />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 items-start gap-3 text-xs text-muted">
              <div>
                <p className="mb-1">Sets</p>
                <div className="flex items-center justify-between rounded-md bg-raised">
                  <button
                    aria-label="Fewer sets"
                    onClick={() => patch(i, { targetSets: Math.max(1, item.targetSets - 1) })}
                    className="p-2"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-base text-fg tabular-nums">{item.targetSets}</span>
                  <button aria-label="More sets" onClick={() => patch(i, { targetSets: item.targetSets + 1 })} className="p-2">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div>
                <p className="mb-1">Reps</p>
                <NumberField value={item.targetReps} placeholder="–" onChange={(v) => patch(i, { targetReps: v })} />
              </div>
              <div>
                <p className="mb-1">Rest</p>
                <button onClick={() => setRestFor(i)} className="w-full rounded-md bg-raised py-1.5 text-base text-info">
                  {formatClock(item.restS ?? item.defaultRestS)}
                </button>
              </div>
            </div>
          </section>
        ))}

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
          label: s ? formatClock(s) : 'Off',
          onSelect: () => restFor !== null && patch(restFor, { restS: s }),
        }))}
      />
      <ExercisePicker open={picking} onClose={() => setPicking(false)} onSelect={(ids, ss) => void addExercises(ids, ss)} />
    </div>
  )
}
