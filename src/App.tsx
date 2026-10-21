import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router'
import { ExerciseDetail } from './features/exercises/ExerciseDetail'
import { HeartRateSettings } from './features/heartRate/HeartRateSettings'
import { ExerciseForm } from './features/exercises/ExerciseForm'
import { ExerciseLibrary } from './features/exercises/ExerciseLibrary'
import { HistoryPage } from './features/history/HistoryPage'
import { WorkoutDetail } from './features/history/WorkoutDetail'
import { ProfilePage } from './features/profile/ProfilePage'
import { StatsPage } from './features/stats/StatsPage'
import { ActiveWorkout } from './features/workout/ActiveWorkout'
import { ActiveWorkoutBanner } from './features/workout/ActiveWorkoutBanner'
import { FinishWorkout } from './features/workout/FinishWorkout'
import { RestWatcher } from './features/workout/RestTimer'
import { WorkoutHome } from './features/workout/WorkoutHome'
import { startWorkoutSession } from './features/workout/workoutSession'
import { RoutineEditor } from './features/routines/RoutineEditor'
import { useActiveWorkout } from './store/activeWorkout'
import { useHeartRate } from './store/heartRate'
import { useProfile } from './store/profile'
import { useSettings } from './store/settings'
import { useStrava } from './store/strava'
import { applyTheme } from './lib/theme'

const tabs = [
  { to: '/', label: 'Workout' },
  { to: '/history', label: 'History' },
  { to: '/stats', label: 'Stats' },
  { to: '/profile', label: 'Profile' },
]

// Full-screen flows hide the tab bar.
const FULL_SCREEN = /^\/(workout|routines|exercises|settings)(\/|$)|^\/history\/./

function useAndroidBackButton() {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const handle = CapApp.addListener('backButton', () => {
      if (location.pathname === '/') void CapApp.minimizeApp()
      else navigate(-1)
    })
    return () => void handle.then((h) => h.remove())
  }, [navigate, location.pathname])
}

const IN_WORKOUT = /^\/workout(\/|$)/

// Leaving the workout screens before completing a set throws the workout away,
// so "Resume" only ever appears for a workout that has actually started.
function useDiscardEmptyWorkoutOnLeave() {
  const { pathname } = useLocation()
  const previous = useRef(pathname)
  useEffect(() => {
    const left = IN_WORKOUT.test(previous.current) && !IN_WORKOUT.test(pathname)
    previous.current = pathname
    if (left) void useActiveWorkout.getState().discardIfEmpty()
  }, [pathname])
}

function Shell() {
  const location = useLocation()
  const fullScreen = FULL_SCREEN.test(location.pathname)
  useAndroidBackButton()
  useDiscardEmptyWorkoutOnLeave()

  return (
    <div className="flex h-full flex-col pt-[env(safe-area-inset-top)]">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<WorkoutHome />} />
          <Route path="/workout" element={<ActiveWorkout />} />
          <Route path="/workout/finish" element={<FinishWorkout />} />
          <Route path="/routines/:id" element={<RoutineEditor />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:id" element={<WorkoutDetail />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/exercises" element={<ExerciseLibrary />} />
          <Route path="/exercises/new" element={<ExerciseForm />} />
          <Route path="/exercises/:id" element={<ExerciseDetail />} />
          <Route path="/exercises/:id/edit" element={<ExerciseForm />} />
          <Route path="/settings/heart-rate" element={<HeartRateSettings />} />
        </Routes>
      </main>
      {!fullScreen && (
        <>
          <ActiveWorkoutBanner />
          <nav className="grid grid-cols-4 border-t border-line bg-surface">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end
                className={({ isActive }) => `py-3 text-center text-sm ${isActive ? 'text-accent-ink' : 'text-muted'}`}
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </>
      )}
      <div className="bg-surface pb-[env(safe-area-inset-bottom)]" />
      <RestWatcher />
    </div>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Don't lose the last few keystrokes of a workout if Android kills us in the background.
    const pause = CapApp.addListener('pause', () => void useActiveWorkout.getState().flush())
    let stopSession: (() => void) | undefined
    Promise.all([
      useSettings.getState().load(),
      useProfile.getState().load(),
      useHeartRate.getState().load(),
      useStrava.getState().load(),
      useActiveWorkout.getState().hydrate(),
    ])
      .then(() => {
        applyTheme(useSettings.getState().theme)
        stopSession = startWorkoutSession()
        setReady(true)
      })
      .catch((err: unknown) => setError(String(err)))
    return () => {
      stopSession?.()
      void pause.then((h) => h.remove())
    }
  }, [])

  if (error) return <p className="p-4 text-bad">Failed to start: {error}</p>
  if (!ready) return null

  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
