// Supersets are consecutive items sharing a non-null supersetGroup. These
// helpers work for both routine items and in-progress workout exercises.
interface Groupable {
  supersetGroup: number | null
}

// Renumbers groups 1..n in order and clears any group left with one member.
export function normalizeSupersets<T extends Groupable>(items: T[]): T[] {
  const out = items.map((i) => ({ ...i }))
  let next = 1
  let i = 0
  while (i < out.length) {
    const g = out[i].supersetGroup
    let j = i + 1
    if (g !== null) while (j < out.length && out[j].supersetGroup === g) j++
    const size = j - i
    for (let k = i; k < j; k++) out[k].supersetGroup = g !== null && size > 1 ? next : null
    if (g !== null && size > 1) next++
    i = j
  }
  return out
}

// Joins item `index` with the item after it (merging into whichever group
// either already belongs to).
export function linkWithNext<T extends Groupable>(items: T[], index: number): T[] {
  if (index < 0 || index >= items.length - 1) return items
  const out = items.map((i) => ({ ...i }))
  const used = out.map((i) => i.supersetGroup ?? 0)
  const g = out[index].supersetGroup ?? out[index + 1].supersetGroup ?? Math.max(0, ...used) + 1
  const oldNext = out[index + 1].supersetGroup
  out[index].supersetGroup = g
  for (let k = index + 1; k < out.length && (k === index + 1 || (oldNext !== null && out[k].supersetGroup === oldNext)); k++)
    out[k].supersetGroup = g
  return normalizeSupersets(out)
}

export function unlink<T extends Groupable>(items: T[], index: number): T[] {
  const out = items.map((i) => ({ ...i }))
  if (out[index]) out[index].supersetGroup = null
  // Removing a middle member splits the superset; give the tail its own group.
  const tailGroup = Math.max(0, ...out.map((i) => i.supersetGroup ?? 0)) + 1
  const g = items[index]?.supersetGroup
  for (let k = index + 1; g != null && k < out.length && out[k].supersetGroup === g; k++) out[k].supersetGroup = tailGroup
  return normalizeSupersets(out)
}

// Consecutive runs of items: each superset is one unit, each single its own.
export function units(items: Groupable[]): number[][] {
  const out: number[][] = []
  for (let i = 0; i < items.length; i++) {
    const g = items[i].supersetGroup
    const last = out.at(-1)
    if (g !== null && last && items[last[0]].supersetGroup === g) last.push(i)
    else out.push([i])
  }
  return out
}

function reorderUnits<T extends Groupable>(items: T[], from: number, to: number): T[] {
  const us = units(items)
  if (to < 0 || to >= us.length || from === to) return items
  const [moved] = us.splice(from, 1)
  us.splice(to, 0, moved)
  return normalizeSupersets(us.flat().map((i) => ({ ...items[i] })))
}

// Moves item `index` one step (-1 up, +1 down) without ever splitting a
// superset: within a superset it swaps with its neighbour; at the edge of its
// superset (or as a single) its whole unit jumps past the adjacent unit.
export function moveItem<T extends Groupable>(items: T[], index: number, delta: -1 | 1): T[] {
  const us = units(items)
  const u = us.findIndex((unit) => unit.includes(index))
  if (u < 0) return items
  const unit = us[u]
  const target = index + delta
  if (unit.length > 1 && unit.includes(target)) {
    const out = items.map((i) => ({ ...i }))
    ;[out[index], out[target]] = [out[target], out[index]]
    return out
  }
  return reorderUnits(items, u, u + delta)
}

// Drag-and-drop: moves the unit containing item `fromIndex` to unit position `toUnit`.
export function moveUnitTo<T extends Groupable>(items: T[], fromIndex: number, toUnit: number): T[] {
  return reorderUnits(
    items,
    units(items).findIndex((unit) => unit.includes(fromIndex)),
    toUnit,
  )
}

export function supersetBounds(items: Groupable[], index: number): { first: number; last: number } {
  const g = items[index].supersetGroup
  let first = index
  let last = index
  if (g === null) return { first, last }
  while (first > 0 && items[first - 1].supersetGroup === g) first--
  while (last < items.length - 1 && items[last + 1].supersetGroup === g) last++
  return { first, last }
}

export type AfterSet = { kind: 'rest'; restS: number; focus: number | null } | { kind: 'next'; index: number }

// After completing a set: within a superset move straight to the next
// exercise; after the last exercise of the round, rest and go back to the
// first exercise of the superset for the next round.
export function afterSetCompleted(items: (Groupable & { restS: number })[], index: number): AfterSet {
  const { first, last } = supersetBounds(items, index)
  if (index < last) return { kind: 'next', index: index + 1 }
  return { kind: 'rest', restS: items[index].restS, focus: first < last ? first : null }
}
