import { Browser } from '@capacitor/browser'

// The token server also hosts the Privacy Policy and Terms.
export const WEB_URL = (import.meta.env.VITE_TOKEN_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
export const PRIVACY_URL = `${WEB_URL}/privacy`
export const TERMS_URL = `${WEB_URL}/terms`

export const openLink = (url: string) => void Browser.open({ url })
