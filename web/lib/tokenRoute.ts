import { allow, clientIp } from './rateLimit'
import { credentialsFromEnv, exchange, parseGrant, type Grant } from './strava'

const NO_STORE = { 'Cache-Control': 'no-store' }

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE })

// Shared handler for /api/strava/token and /api/strava/refresh.
export async function handleTokenRequest(req: Request, kind: Grant['grant_type']): Promise<Response> {
  if (!allow(clientIp(req.headers))) return json({ error: 'rate_limited' }, 429)

  const creds = credentialsFromEnv()
  if (!creds) return json({ error: 'not_configured' }, 500)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_request' }, 400)
  }
  const grant = parseGrant(body, kind)
  if (!grant) return json({ error: 'invalid_request' }, 400)

  try {
    const result = await exchange(grant, creds)
    return json(result.body, result.status)
  } catch {
    return json({ error: 'strava_unavailable' }, 502)
  }
}
