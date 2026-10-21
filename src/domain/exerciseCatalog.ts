import { STRAVA_EXERCISE_GROUPS, type StravaExerciseGroup } from '../strava/exerciseIds'

export const MUSCLES = [
  'chest',
  'shoulders',
  'triceps',
  'biceps',
  'forearms',
  'lats',
  'upper_back',
  'traps',
  'lower_back',
  'abs',
  'obliques',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'abductors',
  'calves',
  'full_body',
  'cardio',
] as const
export type Muscle = (typeof MUSCLES)[number]

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'band',
  'bodyweight',
  'other',
] as const
export type Equipment = (typeof EQUIPMENT)[number]

export type Tracking = 'weight_reps' | 'reps' | 'duration'

export interface CatalogExercise {
  name: string
  stravaExerciseType: string
  category: StravaExerciseGroup
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  equipment: Equipment
  tracking: Tracking
  defaultRestS: number
}

interface GroupInfo {
  primary: Muscle[]
  secondary?: Muscle[]
  restS: number
  timed?: boolean
}

const GROUPS: Record<StravaExerciseGroup, GroupInfo> = {
  'Bench Press': { primary: ['chest'], secondary: ['shoulders', 'triceps'], restS: 120 },
  'Calf Raise': { primary: ['calves'], restS: 60 },
  Cardio: { primary: ['cardio'], secondary: ['full_body'], restS: 60, timed: true },
  Carry: { primary: ['forearms', 'traps'], secondary: ['abs'], restS: 90, timed: true },
  Chop: { primary: ['obliques'], secondary: ['abs', 'shoulders'], restS: 60 },
  Core: { primary: ['abs'], secondary: ['obliques'], restS: 60 },
  Curl: { primary: ['biceps'], secondary: ['forearms'], restS: 90 },
  Deadlift: { primary: ['hamstrings', 'glutes', 'lower_back'], secondary: ['traps', 'forearms'], restS: 180 },
  Flye: { primary: ['chest'], secondary: ['shoulders'], restS: 90 },
  'Hip Raise': { primary: ['glutes'], secondary: ['hamstrings'], restS: 90 },
  'Hip Stability': { primary: ['glutes', 'abductors'], restS: 60 },
  'Hip Swing': { primary: ['glutes', 'hamstrings'], secondary: ['lower_back'], restS: 90 },
  Hyperextension: { primary: ['lower_back'], secondary: ['glutes', 'hamstrings'], restS: 90 },
  'Lateral Raise': { primary: ['shoulders'], restS: 60 },
  'Leg Curl': { primary: ['hamstrings'], restS: 90 },
  'Leg Raise': { primary: ['abs'], restS: 60 },
  Lunge: { primary: ['quads', 'glutes'], secondary: ['hamstrings'], restS: 90 },
  'Olympic Lift': { primary: ['full_body'], secondary: ['quads', 'glutes', 'traps', 'shoulders'], restS: 180 },
  Plank: { primary: ['abs'], secondary: ['obliques', 'shoulders'], restS: 60, timed: true },
  Plyo: { primary: ['quads', 'glutes'], secondary: ['calves'], restS: 90 },
  'Pull Up': { primary: ['lats'], secondary: ['biceps', 'upper_back'], restS: 120 },
  'Push Up': { primary: ['chest'], secondary: ['triceps', 'shoulders'], restS: 90 },
  Row: { primary: ['upper_back', 'lats'], secondary: ['biceps'], restS: 120 },
  'Shoulder Press': { primary: ['shoulders'], secondary: ['triceps'], restS: 120 },
  'Shoulder Stability': { primary: ['shoulders'], secondary: ['upper_back'], restS: 60 },
  Shrug: { primary: ['traps'], restS: 90 },
  'Sit Up': { primary: ['abs'], restS: 60 },
  Squat: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back'], restS: 180 },
  'Total Body': { primary: ['full_body'], restS: 90 },
  'Triceps Extension': { primary: ['triceps'], restS: 90 },
  'Warm Up': { primary: ['full_body'], restS: 30, timed: true },
  'Hip Thrust': { primary: ['glutes'], secondary: ['hamstrings'], restS: 120 },
  'Lower Leg': { primary: ['calves'], restS: 60 },
  'Quad Extension': { primary: ['quads'], restS: 90 },
}

// First matching token wins, so more specific tokens come first.
const EQUIPMENT_TOKENS: [RegExp, Equipment][] = [
  [/(^|_)(BAND|BANDED|RESISTANCE_BAND)(_|$)/, 'band'],
  [/(^|_)(KETTLEBELL|KB)(_|$)/, 'kettlebell'],
  [/(^|_)DUMBBELLS?(_|$)/, 'dumbbell'],
  [/(^|_)(BARBELL|EZ_BAR|TRAP_BAR|SMITH|LANDMINE)(_|$)/, 'barbell'],
  [/(^|_)CABLE(_|$)/, 'cable'],
  [/(^|_)(MACHINE|LEG_PRESS|PULLDOWN|HACK)(_|$)/, 'machine'],
  [/(^|_)(MEDICINE_BALL|SWISS_BALL|STABILITY_BALL|PLATE|SANDBAG|TRX|SUSPENSION|BOX)(_|$)/, 'other'],
]

// Groups where an exercise with no equipment token is almost always bodyweight.
// Elsewhere an untagged exercise is assumed loaded (e.g. 'Seal Row', 'Hang Snatch').
const BODYWEIGHT_GROUPS = new Set<StravaExerciseGroup>([
  'Cardio',
  'Chop',
  'Core',
  'Hip Stability',
  'Leg Raise',
  'Plank',
  'Plyo',
  'Pull Up',
  'Push Up',
  'Shoulder Stability',
  'Sit Up',
  'Total Body',
  'Warm Up',
])
const BODYWEIGHT_ID = /(^|_)(BODY_?WEIGHT|PUSH_UP|PULL_UP|CHIN_UP|DIP|DIPS|STRETCH|PLANK)(_|$)/

function equipmentFor(id: string, group: StravaExerciseGroup): Equipment {
  for (const [re, eq] of EQUIPMENT_TOKENS) if (re.test(id)) return eq
  if (id.endsWith('_GENERIC')) return 'other'
  if (BODYWEIGHT_GROUPS.has(group) || BODYWEIGHT_ID.test(id)) return 'bodyweight'
  return 'other'
}

const WORD_OVERRIDES: Record<string, string> = { EZ: 'EZ', TRX: 'TRX', RDL: 'RDL', KB: 'Kettlebell', BOSU: 'BOSU' }

export function displayName(id: string): string {
  const generic = id.endsWith('_GENERIC')
  const words = (generic ? id.slice(0, -'_GENERIC'.length) : id)
    .split('_')
    .map((w) => WORD_OVERRIDES[w] ?? w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ')
  return generic ? `${words} (General)` : words
}

export function buildCatalog(): CatalogExercise[] {
  const out: CatalogExercise[] = []
  for (const [group, ids] of Object.entries(STRAVA_EXERCISE_GROUPS) as [StravaExerciseGroup, readonly string[]][]) {
    const info = GROUPS[group]
    for (const id of ids) {
      const equipment = equipmentFor(id, group)
      out.push({
        name: displayName(id),
        stravaExerciseType: id,
        category: group,
        primaryMuscles: info.primary,
        secondaryMuscles: info.secondary ?? [],
        equipment,
        tracking: info.timed ? 'duration' : equipment === 'bodyweight' ? 'reps' : 'weight_reps',
        defaultRestS: info.restS,
      })
    }
  }
  return out
}
