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
  timed?: boolean
}

const GROUPS: Record<StravaExerciseGroup, GroupInfo> = {
  'Bench Press': { primary: ['chest'], secondary: ['shoulders', 'triceps'] },
  'Calf Raise': { primary: ['calves'] },
  Cardio: { primary: ['cardio'], secondary: ['full_body'], timed: true },
  Carry: { primary: ['forearms', 'traps'], secondary: ['abs'], timed: true },
  Chop: { primary: ['obliques'], secondary: ['abs', 'shoulders'] },
  Core: { primary: ['abs'], secondary: ['obliques'] },
  Curl: { primary: ['biceps'], secondary: ['forearms'] },
  Deadlift: { primary: ['hamstrings', 'glutes', 'lower_back'], secondary: ['traps', 'forearms'] },
  Flye: { primary: ['chest'], secondary: ['shoulders'] },
  'Hip Raise': { primary: ['glutes'], secondary: ['hamstrings'] },
  'Hip Stability': { primary: ['glutes', 'abductors'] },
  'Hip Swing': { primary: ['glutes', 'hamstrings'], secondary: ['lower_back'] },
  Hyperextension: { primary: ['lower_back'], secondary: ['glutes', 'hamstrings'] },
  'Lateral Raise': { primary: ['shoulders'] },
  'Leg Curl': { primary: ['hamstrings'] },
  'Leg Raise': { primary: ['abs'] },
  Lunge: { primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  'Olympic Lift': { primary: ['full_body'], secondary: ['quads', 'glutes', 'traps', 'shoulders'] },
  Plank: { primary: ['abs'], secondary: ['obliques', 'shoulders'], timed: true },
  Plyo: { primary: ['quads', 'glutes'], secondary: ['calves'] },
  'Pull Up': { primary: ['lats'], secondary: ['biceps', 'upper_back'] },
  'Push Up': { primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  Row: { primary: ['upper_back', 'lats'], secondary: ['biceps'] },
  'Shoulder Press': { primary: ['shoulders'], secondary: ['triceps'] },
  'Shoulder Stability': { primary: ['shoulders'], secondary: ['upper_back'] },
  Shrug: { primary: ['traps'] },
  'Sit Up': { primary: ['abs'] },
  Squat: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back'] },
  'Total Body': { primary: ['full_body'] },
  'Triceps Extension': { primary: ['triceps'] },
  'Warm Up': { primary: ['full_body'], timed: true },
  'Hip Thrust': { primary: ['glutes'], secondary: ['hamstrings'] },
  'Lower Leg': { primary: ['calves'] },
  'Quad Extension': { primary: ['quads'] },
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
        // Rest timers start off; set a default per exercise in the library if wanted.
        defaultRestS: 0,
      })
    }
  }
  return out
}
