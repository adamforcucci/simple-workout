// Best-effort per-IP limiter. State lives in one serverless instance, so it
// only blunts bursts; add a Vercel Firewall rate-limit rule for real limits.
const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS = 30

const hits = new Map<string, number[]>()

export function allow(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_REQUESTS) {
    hits.set(ip, recent)
    return false
  }
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 10_000) hits.clear() // never grow without bound
  return true
}

export function clientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
}
