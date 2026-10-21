import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Terms of Use' }

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'privacy@example.com'
const UPDATED = '22 October 2026'

export default function Terms() {
  return (
    <>
      <h1>Terms of Use</h1>
      <p className="muted">Last updated {UPDATED}</p>
      <p className="draft">
        Draft for the private test release. To be reviewed by a lawyer before the app is offered to the public.
      </p>

      <h2>Test release</h2>
      <p>
        Workout is currently a free, invitation-only test version. It may change, have bugs or stop being available.
        Keep a backup (Profile → Backup) of anything you care about.
      </p>

      <h2>Not medical advice</h2>
      <p>
        The app is a training log. Heart rate, zones, calories and estimated one-rep maxes are estimates for general
        fitness only and are not medical advice. Check with a health professional before starting a new exercise
        program, and stop if you feel pain, dizziness or shortness of breath. Train within your abilities and use
        spotters and safety equipment as appropriate.
      </p>

      <h2>Your data</h2>
      <p>
        Your workout data is yours and is stored on your phone, as described in the <a href="/privacy">Privacy Policy</a>
        . You&apos;re responsible for backing it up.
      </p>

      <h2>Strava</h2>
      <p>
        Strava is a third-party service with its own terms. Connecting it is optional, and Strava is not responsible
        for this app. Strava provides its service and any data from it &ldquo;as is&rdquo;, and makes no warranties
        about this app. Strava may change or withdraw its integration at any time, which may affect syncing.
      </p>

      <h2>Acceptable use</h2>
      <p>Don&apos;t misuse the app or its server, for example by trying to access other people&apos;s data or overload the service.</p>

      <h2>Consumer law</h2>
      <p>
        Nothing in these terms excludes rights you have under the Australian Consumer Law or other laws that can&apos;t
        be excluded. Subject to those, the app is provided as is, and to the extent the law allows we aren&apos;t liable
        for indirect loss or lost data.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </>
  )
}
