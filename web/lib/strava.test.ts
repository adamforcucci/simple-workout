import { describe, expect, test, vi } from 'vitest'
import { allow } from './rateLimit'
import { credentialsFromEnv, exchange, parseGrant } from './strava'

const CODE = 'd83915ddf780b425a7ba374f9acb1b832b1a54d9'
const creds = { clientId: '123', clientSecret: 'shh' }

describe('parseGrant', () => {
  test('accepts only the expected field for each grant', () => {
    expect(parseGrant({ code: CODE }, 'authorization_code')).toEqual({ grant_type: 'authorization_code', code: CODE })
    expect(parseGrant({ refresh_token: CODE }, 'refresh_token')).toEqual({ grant_type: 'refresh_token', refresh_token: CODE })
    expect(parseGrant({ refresh_token: CODE }, 'authorization_code')).toBeNull()
  })

  test('rejects junk, injection and wrong types', () => {
    for (const bad of [null, 'x', {}, { code: 5 }, { code: 'a&client_secret=x' }, { code: 'short' }, { code: 'x'.repeat(200) }])
      expect(parseGrant(bad, 'authorization_code')).toBeNull()
  })
})

describe('exchange', () => {
  test('posts credentials to Strava and returns only what the app needs', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        access_token: 'a',
        refresh_token: 'r',
        expires_at: 99,
        athlete: { id: 1, firstname: 'Adam', lastname: 'F', city: 'Melbourne', profile: 'https://…' },
        token_type: 'Bearer',
      }),
    )
    const res = await exchange({ grant_type: 'authorization_code', code: CODE }, creds, fetchImpl as unknown as typeof fetch)
    expect(res).toEqual({
      status: 200,
      body: { access_token: 'a', refresh_token: 'r', expires_at: 99, athlete: { id: 1, firstname: 'Adam', lastname: 'F' } },
    })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://www.strava.com/oauth/token')
    expect(Object.fromEntries(new URLSearchParams(init.body as URLSearchParams))).toEqual({
      client_id: '123',
      client_secret: 'shh',
      grant_type: 'authorization_code',
      code: CODE,
    })
  })

  test('maps Strava failures without leaking details', async () => {
    const bad = vi.fn(async () => new Response('{"message":"Bad Request","errors":[…]}', { status: 400 }))
    expect(await exchange({ grant_type: 'refresh_token', refresh_token: CODE }, creds, bad as unknown as typeof fetch)).toEqual({
      status: 401,
      body: { error: 'invalid_grant' },
    })
    const down = vi.fn(async () => new Response('', { status: 503 }))
    expect((await exchange({ grant_type: 'refresh_token', refresh_token: CODE }, creds, down as unknown as typeof fetch)).status).toBe(502)
  })
})

describe('config and rate limit', () => {
  test('credentials come from the environment', () => {
    expect(credentialsFromEnv({})).toBeNull()
    expect(credentialsFromEnv({ STRAVA_CLIENT_ID: '1', STRAVA_CLIENT_SECRET: 's' })).toEqual({ clientId: '1', clientSecret: 's' })
  })

  test('30 requests per 10 minutes per IP', () => {
    const t = 1_000_000
    for (let i = 0; i < 30; i++) expect(allow('1.2.3.4', t + i)).toBe(true)
    expect(allow('1.2.3.4', t + 31)).toBe(false)
    expect(allow('5.6.7.8', t + 31)).toBe(true)
    expect(allow('1.2.3.4', t + 11 * 60 * 1000)).toBe(true)
  })
})
