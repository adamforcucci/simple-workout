import Link from 'next/link'

export default function Home() {
  return (
    <>
      <h1>Adam&apos;s Workout App</h1>
      <p>A no-nonsense gym tracker for Android: routines, supersets, rest timers, Bluetooth heart rate and Strava sync.</p>
      <p className="muted">
        No ads, no accounts, no tracking and no data for sale. Your workouts stay on your phone; nothing is uploaded except
        to Strava, when you choose to.
      </p>
      <p>
        <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Use</Link>
      </p>
    </>
  )
}
