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

export function moveItem<T extends Groupable>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items
  const out = items.map((i) => ({ ...i }))
  const [moved] = out.splice(from, 1)
  moved.supersetGroup = null
  out.splice(to, 0, moved)
  return normalizeSupersets(out)
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

export type AfterSet = { kind: 'rest'; restS: number } | { kind: 'next'; index: number }

// After completing a set: within a superset move straight to the next
// exercise; rest only after the last exercise of the round.
export function afterSetCompleted(items: (Groupable & { restS: number })[], index: number): AfterSet {
  const { last } = supersetBounds(items, index)
  if (index < last) return { kind: 'next', index: index + 1 }
  return { kind: 'rest', restS: items[index].restS }
}
