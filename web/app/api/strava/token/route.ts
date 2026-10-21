import { handleTokenRequest } from '@/lib/tokenRoute'

export const dynamic = 'force-dynamic'

// Exchanges a Strava authorization code for tokens.
export function POST(req: Request) {
  return handleTokenRequest(req, 'authorization_code')
}
