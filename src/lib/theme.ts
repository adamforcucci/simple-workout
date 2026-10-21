import { Capacitor, registerPlugin } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

export type ThemePref = 'system' | 'light' | 'dark'

// Mirrored to localStorage so index.html can paint the right theme before the
// database (where settings live) has loaded. Keep the key in sync with index.html.
const STORAGE_KEY = 'theme'
const APP_BG = { light: '#f4f4f5', dark: '#09090b' } as const

// Native side paints the launch window/WebView in this theme (see ThemePlugin.java).
const NativeTheme = registerPlugin<{ setPreference(o: { pref: ThemePref }): Promise<void> }>('Theme')

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)')

let stopWatching: (() => void) | undefined

function apply(resolved: 'light' | 'dark') {
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.background = APP_BG[resolved]
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', APP_BG[resolved])
  // Style.Dark = light status-bar icons, for dark backgrounds.
  if (Capacitor.isNativePlatform())
    void StatusBar.setStyle({ style: resolved === 'dark' ? Style.Dark : Style.Light }).catch(() => {})
}

export function applyTheme(pref: ThemePref) {
  try {
    localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    // Storage unavailable: the theme still applies, just not before first paint.
  }
  if (Capacitor.isNativePlatform()) void NativeTheme.setPreference({ pref }).catch(() => {})
  stopWatching?.()
  stopWatching = undefined
  if (pref !== 'system') return apply(pref)

  const mq = systemDark()
  const onChange = () => apply(mq.matches ? 'dark' : 'light')
  onChange()
  mq.addEventListener('change', onChange)
  stopWatching = () => mq.removeEventListener('change', onChange)
}
