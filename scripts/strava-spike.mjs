// Spike: confirm Strava renders exercises + muscle map from a JSON strength upload.
//
// Usage:
//   1. Fill VITE_STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET in .env
//   2. node --env-file=.env scripts/strava-spike.mjs            → prints the approval URL
//   3. Open it, approve; the browser lands on a localhost page that won't load.
//   4. node --env-file=.env scripts/strava-spike.mjs <code>     → `code` from that URL

const clientId = process.env.VITE_STRAVA_CLIENT_ID
const clientSecret = process.env.STRAVA_CLIENT_SECRET
if (!clientId || !clientSecret) {
  console.error('Missing VITE_STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET in .env')
  process.exit(1)
}

const authUrl = new URL('https://www.strava.com/oauth/authorize')
authUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: 'http://localhost/exchange',
  response_type: 'code',
  approval_prompt: 'force',
  scope: 'read,activity:write',
}).toString()

const code = process.argv[2]?.trim()
if (!code) {
  console.log(`\nOpen this URL and approve:\n\n${authUrl}\n`)
  process.exit(0)
}

const tokenRes = await fetch('https://www.strava.com/oauth/token', {
  method: 'POST',
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
  }),
})
const token = await tokenRes.json()
if (!token.access_token) {
  console.error('Token exchange failed:', token)
  process.exit(1)
}

// Two exercises, 30 min ago, with a synthetic HR stream every 5s.
const start = new Date(Date.now() - 30 * 60 * 1000)
const iso = (offsetS) => new Date(start.getTime() + offsetS * 1000).toISOString()
const elapsed = 20 * 60
const time = Array.from({ length: elapsed / 5 + 1 }, (_, i) => i * 5)
const heartrate = time.map((t) => Math.round(110 + 25 * Math.sin(t / 60)))

const workout = {
  version: '1.0',
  start_time: start.toISOString(),
  utc_offset: -start.getTimezoneOffset() * 60,
  elapsed_time: elapsed,
  active_time: elapsed,
  total_calories: 180,
  creator: { name: "Adam's Workout App (spike)" },
  streams: { time, heartrate },
  sets: [
    { exercise_type: 'BARBELL_BENCH_PRESS', repetitions: 8, weight: 60, start_time: iso(60) },
    { exercise_type: 'BARBELL_BENCH_PRESS', repetitions: 8, weight: 60, start_time: iso(240) },
    { exercise_type: 'BARBELL_BACK_SQUAT', repetitions: 5, weight: 80, start_time: iso(600) },
    { exercise_type: 'BARBELL_BACK_SQUAT', repetitions: 5, weight: 80, start_time: iso(840) },
  ],
}

const form = new FormData()
form.append('file', new Blob([JSON.stringify(workout)], { type: 'application/json' }), 'workout.json')
form.append('data_type', 'json')
form.append('name', 'Strength spike test')
form.append('description', 'Bench Press 2x8 @ 60kg\nBack Squat 2x5 @ 80kg')
form.append('external_id', `spike-${Date.now()}`)

const auth = { Authorization: `Bearer ${token.access_token}` }
let upload = await (
  await fetch('https://www.strava.com/api/v3/uploads', { method: 'POST', headers: auth, body: form })
).json()
console.log('Upload created:', upload)

for (let i = 0; i < 15 && !upload.activity_id && !upload.error; i++) {
  await new Promise((r) => setTimeout(r, 2000))
  upload = await (await fetch(`https://www.strava.com/api/v3/uploads/${upload.id}`, { headers: auth })).json()
  console.log('Status:', upload.status)
}

if (upload.activity_id) {
  // Keep the test out of followers' home feeds.
  const mute = await fetch(`https://www.strava.com/api/v3/activities/${upload.activity_id}`, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ hide_from_home: true }),
  })
  console.log(mute.ok ? 'Muted from home feed.' : `Could not mute (${mute.status}).`)
  console.log(`\nDone → https://www.strava.com/activities/${upload.activity_id}`)
  console.log('Check: WeightTraining type, exercise list with sets, muscle map, HR graph, calories.')
} else {
  console.error('\nUpload did not produce an activity:', upload)
  process.exit(1)
}
