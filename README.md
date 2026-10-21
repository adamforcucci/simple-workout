# Simple Workout

Personal Android gym tracker (Hevy-style logging), sideloaded in dev mode. Data stays on the phone; workouts sync to Strava with Strava's own exercise list and muscle map.

## Stack

- React 19, Vite, Tailwind 4, Zustand, Recharts, inside **Capacitor 8** (Android only)
- SQLite on device (`@capacitor-community/sqlite`; `jeep-sqlite` in the browser, `sql.js` in tests)
- Native Java (`android/app/src/main/java/au/com/adam/gym/`): a foreground service that owns the Bluetooth heart rate connection, buffers samples and fires rest alarms, so both work with the screen off

## Setup

1. Android Studio (bundles the SDK and a JDK). Gradle runs on Studio's JDK; a JDK 21 toolchain some plugins need is downloaded automatically.
2. `yarn` (also copies `sql-wasm.wasm` into `public/assets`)
3. `cp .env.example .env` and fill in the Strava API app's client ID/secret (callback domain `strava.local`)

```sh
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

## Commands

| | |
|---|---|
| `yarn dev` | Browser dev server (simulated heart rate strap; Strava needs the phone) |
| `yarn android` | Build and install on the USB-connected phone |
| `yarn test` | Vitest (domain logic, repos, stores against in-memory SQLite) |
| `cd android && ./gradlew :app:testDebugUnitTest` | Native unit tests (heart rate packet parser) |
| `yarn lint` | oxlint |

## Layout

- `src/db/` — migrations, repos, backup/restore
- `src/domain/` — pure logic: exercise catalog, sets/1RM, PRs, supersets, calories, HR zones, stats
- `src/store/` — Zustand stores (active workout, settings, profile, heart rate, Strava)
- `src/features/` — screens
- `src/strava/` — OAuth, JSON strength upload ([format](https://developers.strava.com/docs/uploads/)), generated exercise IDs
- `src/native/workoutService.ts` — TS bridge to the native service
- `scripts/strava-spike.mjs` — standalone upload test used to validate the Strava format
