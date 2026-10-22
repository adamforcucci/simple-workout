import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Policy' }

// Contact address shown to users for privacy requests.
const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'privacy@example.com'
const UPDATED = '22 October 2026'

export default function Privacy() {
  return (
    <article className="doc mx-auto max-w-3xl rounded-3xl border border-white/10 bg-black/60 p-6 backdrop-blur-xl sm:p-10">
      <h1>Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-400">Last updated {UPDATED}</p>
      <p className="mt-6 rounded-xl border border-brand-yellow/30 bg-brand-yellow/5 px-4 py-3 text-sm text-zinc-300">
        Draft for the private test release. To be reviewed by a lawyer before the app is offered to the public.
      </p>

      <h2>The short version</h2>
      <p>
        Adam&apos;s Workout App keeps your data on your phone. We don&apos;t run accounts, we don&apos;t have a copy of your workouts,
        and we don&apos;t sell or share your information. If you connect Strava, the app sends the workouts you choose to
        Strava, and nowhere else. If you turn on Health Connect, it copies your workouts there, on your phone.
      </p>

      <h2>What the app stores on your phone</h2>
      <ul>
        <li>Your profile: name, date of birth, sex, height, body weight entries and an optional maximum heart rate.</li>
        <li>Your routines, workouts, sets, reps, weights, notes and timings.</li>
        <li>Heart rate readings from a Bluetooth heart rate monitor you pair, recorded only during a workout.</li>
        <li>Settings, the paired monitor&apos;s Bluetooth address, and your Strava sign-in tokens.</li>
      </ul>
      <p>
        This data stays in the app&apos;s private storage on your phone. Uninstalling the app deletes it. You can export
        a backup file yourself from Profile → Backup; that file contains your workout data (but never your Strava
        sign-in) and goes wherever you choose to share it.
      </p>
      <p>
        Age, sex, body weight and heart rate are used on your phone to estimate calories and heart rate zones. Heart
        rate may be health information; it is never sent to us.
      </p>

      <h2>Strava</h2>
      <p>Connecting Strava is optional. If you connect it:</p>
      <ul>
        <li>
          <strong>What is sent to Strava:</strong> for each workout you upload (automatically on save, or when you tap
          Upload), its name, start time, duration, exercises and sets (weight, reps or time), your heart rate readings,
          estimated calories, notes and a written summary. This is sent from your phone directly to Strava.
        </li>
        <li>
          <strong>What the app receives from Strava:</strong> sign-in tokens, your Strava first and last name, and the
          upload status and activity link for workouts you upload.
        </li>
        <li>
          <strong>Our server</strong> only completes the Strava sign-in on the app&apos;s behalf (exchanging a one-time
          code or refresh token for an access token), because that step needs a secret that can&apos;t be kept inside
          the app. It doesn&apos;t store or log the tokens or anything else.
        </li>
        <li>
          <strong>Withdrawing consent:</strong> tap Disconnect in Profile → Strava, or revoke access in Strava&apos;s
          settings. The app deletes its Strava tokens and stops uploading. Activities already on Strava are managed under{' '}
          <a href="https://www.strava.com/legal/privacy">Strava&apos;s Privacy Policy</a>, and you can delete them in
          Strava.
        </li>
      </ul>

      <h2>Health Connect (Android)</h2>
      <p>
        Saving to Health Connect is optional and off until you turn it on in Profile → Health Connect and grant access.
        When on, the app writes each finished workout to Health Connect on your phone: an exercise session (name, times,
        notes, and each set&apos;s exercise type and reps), the heart rate readings recorded during it, and its estimated
        calories. The app only writes; it never reads anything from Health Connect. Other apps can see this data only
        if you give them access in Health Connect. Turn it off in the app, or remove the app&apos;s access in Health
        Connect&apos;s settings, where you can also delete what it wrote. Deleting a workout in the app deletes its copy
        in Health Connect too.
      </p>

      <h2>What we (the developer) collect</h2>
      <p>
        Nothing that identifies you. We don&apos;t use analytics, advertising or tracking SDKs, and we can&apos;t see
        your workouts. The Google Play Store may give us aggregate statistics such as install counts and crash reports,
        under Google&apos;s own privacy policy.
      </p>

      <h2>Deleting your data</h2>
      <p>
        Your data is on your phone, so you are in control of it: delete individual workouts in the app, or uninstall
        the app to delete everything. Disconnecting Strava deletes the app&apos;s Strava tokens immediately. If you ask
        us to delete any data about you, we will confirm in writing; in practice we hold none.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live (for example under the Australian Privacy Act or the EU/UK GDPR) you have rights to
        access, correct and delete personal information and to complain to a regulator (in Australia, the{' '}
        <a href="https://www.oaic.gov.au">OAIC</a>). Because your data stays on your phone, you can exercise most of
        these directly in the app.
      </p>

      <h2>Children</h2>
      <p>Adam&apos;s Workout App isn&apos;t intended for children under 16.</p>

      <h2>Changes</h2>
      <p>If this policy changes, the updated version will be posted here with a new date.</p>

      <h2>Contact</h2>
      <p>
        Questions or requests: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </article>
  )
}
