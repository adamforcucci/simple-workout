import type { Db } from './types'

// Append-only. Each entry runs once, tracked in schema_version (PRAGMA
// user_version is left alone because the Capacitor plugin manages it).
// Timestamps are epoch milliseconds; calendar dates are 'YYYY-MM-DD' text.
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL DEFAULT '',
    dob TEXT,
    sex TEXT CHECK (sex IN ('male', 'female')),
    height_cm REAL,
    max_hr_override INTEGER
  );
  INSERT INTO profile (id) VALUES (1);

  CREATE TABLE body_metrics (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    weight_kg REAL,
    body_fat_pct REAL
  );

  CREATE TABLE exercises (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    strava_exercise_type TEXT NOT NULL,
    category TEXT NOT NULL,
    primary_muscles TEXT NOT NULL DEFAULT '',
    secondary_muscles TEXT NOT NULL DEFAULT '',
    equipment TEXT NOT NULL,
    tracking TEXT NOT NULL CHECK (tracking IN ('weight_reps', 'reps', 'duration')),
    default_rest_s INTEGER NOT NULL DEFAULT 90,
    is_custom INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX exercises_builtin_strava ON exercises (strava_exercise_type) WHERE is_custom = 0;
  CREATE INDEX exercises_name ON exercises (name);

  CREATE TABLE routines (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE routine_items (
    id INTEGER PRIMARY KEY,
    routine_id INTEGER NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises (id),
    position INTEGER NOT NULL,
    superset_group INTEGER,
    target_sets INTEGER NOT NULL DEFAULT 3,
    target_reps INTEGER,
    rest_s INTEGER
  );
  CREATE INDEX routine_items_routine ON routine_items (routine_id, position);

  CREATE TABLE workouts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    routine_id INTEGER REFERENCES routines (id) ON DELETE SET NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    utc_offset_s INTEGER NOT NULL,
    avg_hr INTEGER,
    max_hr INTEGER,
    calories INTEGER
  );
  CREATE INDEX workouts_started ON workouts (started_at);

  CREATE TABLE workout_exercises (
    id INTEGER PRIMARY KEY,
    workout_id INTEGER NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises (id),
    position INTEGER NOT NULL,
    superset_group INTEGER,
    rest_s INTEGER NOT NULL,
    notes TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX workout_exercises_workout ON workout_exercises (workout_id, position);
  CREATE INDEX workout_exercises_exercise ON workout_exercises (exercise_id);

  CREATE TABLE sets (
    id INTEGER PRIMARY KEY,
    workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'normal' CHECK (type IN ('warmup', 'normal', 'drop', 'failure')),
    weight_kg REAL,
    reps INTEGER,
    duration_s INTEGER,
    rpe REAL,
    completed_at INTEGER
  );
  CREATE INDEX sets_workout_exercise ON sets (workout_exercise_id, position);

  CREATE TABLE hr_samples (
    workout_id INTEGER NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
    t_offset_s INTEGER NOT NULL,
    bpm INTEGER NOT NULL,
    PRIMARY KEY (workout_id, t_offset_s)
  ) WITHOUT ROWID;

  CREATE TABLE strava_sync (
    workout_id INTEGER PRIMARY KEY REFERENCES workouts (id) ON DELETE CASCADE,
    upload_id INTEGER,
    activity_id INTEGER,
    status TEXT NOT NULL,
    error TEXT,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
]

export async function migrate(db: Db): Promise<void> {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)')
  const row = await db.get<{ version: number }>('SELECT version FROM schema_version')
  if (!row) await db.run('INSERT INTO schema_version (version) VALUES (0)')
  for (let v = row?.version ?? 0; v < MIGRATIONS.length; v++) {
    await db.tx(async () => {
      await db.exec(MIGRATIONS[v])
      await db.run('UPDATE schema_version SET version = ?', [v + 1])
    })
  }
}
