import Image from 'next/image'

const PRINCIPLES = [
  { title: 'No ads', body: 'Nothing to sell you, nobody paying to reach you.' },
  { title: 'No accounts', body: 'Open the app and train. No sign-up, no email.' },
  { title: 'No tracking', body: 'Your workouts stay on your phone. Strava only if you connect it.' },
]

const FEATURES = [
  {
    title: 'Routines and supersets',
    body: 'Default weights, reps and rest per exercise. Supersets move you to the next exercise, then back to the start of the round.',
  },
  {
    title: 'Last time, beside every set',
    body: 'See what you lifted last session, or flip to your best-ever set. Warm-up, drop and failure sets included.',
  },
  {
    title: 'A rest timer you can’t miss',
    body: 'Starts when you tick a set. Vibrates and beeps when rest is up, even with the screen locked.',
  },
  {
    title: 'Bluetooth heart rate',
    body: 'Pairs with standard chest and arm straps. Keeps recording with the screen off; calories come from your heart rate.',
  },
  {
    title: 'Calendar and stats',
    body: 'History calendar, weekly volume, sets per muscle, estimated one-rep max trends and a body weight log.',
  },
  {
    title: 'Backups you control',
    body: 'Export a backup file whenever you like and keep it wherever you want. Light, dark or match-your-phone theme.',
  },
]

const SCREENS = [
  { src: '/screens/workout.webp', alt: 'A workout in progress with sets, a superset and the rest timer', caption: 'Log sets, rest, repeat' },
  { src: '/screens/heart-rate.webp', alt: 'A finished workout with its heart rate graph and time in zones', caption: 'Heart rate and zones' },
  { src: '/screens/history.webp', alt: 'History calendar with workout days highlighted', caption: 'Every session, on a calendar' },
]

function Phone({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/15 bg-black p-1.5 shadow-2xl shadow-black/60">
      <Image src={src} alt={alt} width={720} height={1440} className="h-auto w-full rounded-[1.6rem]" />
    </div>
  )
}

export default function Home() {
  return (
    <div className="flex flex-col gap-24">
      <section className="max-w-2xl">
        <p className="mb-4 text-sm font-semibold tracking-widest text-brand-yellow uppercase">Android · Private test</p>
        <h1 className="text-4xl leading-[1.05] font-bold tracking-tight text-white sm:text-6xl">
          Log your sets.
          <br />
          Keep your data.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-zinc-300">
          A no-nonsense gym tracker: routines, supersets, rest timers, Bluetooth heart rate, and sync to Strava and
          Health Connect, with everything stored on your phone.
        </p>
      </section>

      <ul className="grid gap-4 sm:grid-cols-3">
        {PRINCIPLES.map((p) => (
          <li key={p.title} className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-md">
            <p className="font-semibold text-white">{p.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">{p.body}</p>
          </li>
        ))}
      </ul>

      <section>
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Everything a gym log needs</h2>
        <p className="mt-2 text-zinc-400">And nothing it doesn&apos;t: no feed, no followers, no notifications.</p>
        <ul className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="border-l-2 border-brand-teal-bright/60 pl-4">
              <p className="font-semibold text-white">{f.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <ul className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-8 sm:overflow-visible sm:px-0 lg:px-12">
          {SCREENS.map((s) => (
            <li key={s.src} className="w-52 shrink-0 snap-center sm:w-auto">
              <Phone src={s.src} alt={s.alt} />
              <p className="mt-3 text-center text-sm text-zinc-400">{s.caption}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
          <Image
            src="/strava/compatible-with-strava-white.svg"
            alt="Compatible with Strava"
            width={437}
            height={37}
            className="h-4 w-auto"
          />
          <p className="mt-4 text-sm leading-relaxed text-zinc-300">
            Connect Strava and workouts upload as Weight Training with your exercises, sets, heart rate and calories,
            so Strava shows its own workout log and muscle map. Optional, and you can disconnect any time.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
          <p className="font-semibold text-white">Health Connect</p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Turn it on to save each workout to Android&apos;s Health Connect with its sets, heart rate and calories.
            Write-only: the app never reads your health data.
          </p>
        </div>
      </section>
    </div>
  )
}
