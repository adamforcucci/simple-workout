// Strava OAuth token exchange on behalf of the app, so the client secret never
// ships in the APK. It only swaps codes/refresh tokens for access tokens and
// returns them to the caller; nothing is stored or logged here.

export type Grant =
  | { grant_type: 'authorization_code'; code: string }
  | { grant_type: 'refresh_token'; refresh_token: string }

export interface TokenResult {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete?: { id: number; firstname: string; lastname: string }
}

export interface Credentials {
  clientId: string
  clientSecret: string
}

// Strava codes and refresh tokens are 40-char hex; allow some slack.
const TOKEN_SHAPE = /^[A-Za-z0-9]{20,100}$/

export function parseGrant(body: unknown, kind: Grant['grant_type']): Grant | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  if (kind === 'authorization_code') {
    return typeof b.code === 'string' && TOKEN_SHAPE.test(b.code) ? { grant_type: kind, code: b.code } : null
  }
  return typeof b.refresh_token === 'string' && TOKEN_SHAPE.test(b.refresh_token)
    ? { grant_type: kind, refresh_token: b.refresh_token }
    : null
}

export function credentialsFromEnv(env: Record<string, string | undefined> = process.env): Credentials | null {
  const clientId = env.STRAVA_CLIENT_ID
  const clientSecret = env.STRAVA_CLIENT_SECRET
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

export async function exchange(
  grant: Grant,
  creds: Credentials,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number; body: TokenResult | { error: string } }> {
  const res = await fetchImpl('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: creds.clientId, client_secret: creds.clientSecret, ...grant }),
    cache: 'no-store',
  })
  if (!res.ok) {
    // Strava's 400/401 means a bad or revoked code/token; anything else is upstream trouble.
    const status = res.status === 400 || res.status === 401 ? 401 : 502
    return { status, body: { error: status === 401 ? 'invalid_grant' : 'strava_unavailable' } }
  }
  const t = (await res.json()) as TokenResult
  // Pass through only what the app needs.
  return {
    status: 200,
    body: {
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: t.expires_at,
      ...(t.athlete && { athlete: { id: t.athlete.id, firstname: t.athlete.firstname, lastname: t.athlete.lastname } }),
    },
  }
}
