import { handleTokenRequest } from '@/lib/tokenRoute'

export const dynamic = 'force-dynamic'

// Exchanges a Strava refresh token for a fresh access token.
export function POST(req: Request) {
  return handleTokenRequest(req, 'refresh_token')
}
