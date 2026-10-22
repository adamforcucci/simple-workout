const PRINCIPLES = [
  { title: 'No ads', body: 'Nothing to sell you, nobody paying to reach you.' },
  { title: 'No accounts', body: 'Open the app and train. No sign-up, no email.' },
  { title: 'No tracking', body: 'Your workouts stay on your phone. Strava only if you connect it.' },
]

export default function Home() {
  return (
    <div className="flex flex-col gap-14">
      <section className="max-w-2xl">
        <p className="mb-4 text-sm font-semibold tracking-widest text-brand-yellow uppercase">Android · Private test</p>
        <h1 className="text-4xl leading-[1.05] font-bold tracking-tight text-white sm:text-6xl">
          Log your sets.
          <br />
          Keep your data.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-zinc-300">
          A no-nonsense gym tracker: routines, supersets, rest timers, Bluetooth heart rate and Strava sync, with
          everything stored on your phone.
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
    </div>
  )
}
