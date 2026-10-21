import Link from 'next/link'

export default function Home() {
  return (
    <>
      <h1>Workout</h1>
      <p>A gym workout tracker for Android: routines, supersets, rest timers, Bluetooth heart rate and Strava sync.</p>
      <p className="muted">Your workouts stay on your phone. Nothing is uploaded except to Strava, when you choose to.</p>
      <p>
        <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Use</Link>
      </p>
    </>
  )
}
