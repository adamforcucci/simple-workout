import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: { default: "Adam's Workout App", template: "%s · Adam's Workout App" },
  description: 'A no-nonsense gym tracker for Android. No ads, no accounts, no tracking: your data stays on your phone.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
