import type { Metadata, Viewport } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { BlobBackground } from './components/BlobBackground'
import './globals.css'

export const metadata: Metadata = {
  title: { default: "Adam's Workout App", template: "%s · Adam's Workout App" },
  description: 'A no-nonsense gym tracker for Android. No ads, no accounts, no tracking: your data stays on your phone.',
}

export const viewport: Viewport = { themeColor: '#000000' }

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL

function Header() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center px-5 py-5 sm:px-8">
      <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
        <Image src="/icon-512.png" alt="" width={36} height={36} className="rounded-[10px]" priority />
        <span className="text-white">Adam&apos;s Workout App</span>
      </Link>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-5 py-8 text-sm text-zinc-400 sm:px-8">
      <div className="flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} Adam&apos;s Workout App · No ads, no accounts, no tracking.
        </p>
        <div className="flex gap-5">
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
          {CONTACT && (
            <a href={`mailto:${CONTACT}`} className="hover:text-white">
              Contact
            </a>
          )}
        </div>
      </div>
    </footer>
  )
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <BlobBackground />
        <div className="relative z-10 flex min-h-screen flex-col justify-between">
          <Header />
          <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-16">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
