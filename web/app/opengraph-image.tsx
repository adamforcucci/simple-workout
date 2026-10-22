import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const alt = "Adam's Workout App: log your sets, keep your data"
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Link preview card: the site's black background with teal and yellow glows.
export default async function OpenGraphImage() {
  const icon = await readFile(join(process.cwd(), 'public/icon-512.png'))
  const iconSrc = `data:image/png;base64,${icon.toString('base64')}`

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 80,
        background: '#000',
        backgroundImage:
          'radial-gradient(circle at 85% 20%, rgba(14,116,144,0.85), transparent 45%), radial-gradient(circle at 70% 95%, rgba(23,179,194,0.45), transparent 40%), radial-gradient(circle at 100% 60%, rgba(250,204,21,0.25), transparent 30%)',
        color: '#fff',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconSrc} width={88} height={88} style={{ borderRadius: 22 }} alt="" />
        <div style={{ fontSize: 40, fontWeight: 600 }}>Adam&apos;s Workout App</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 92, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2 }}>Log your sets.</div>
        <div style={{ fontSize: 92, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2 }}>Keep your data.</div>
        <div style={{ marginTop: 32, fontSize: 32, color: '#d4d4d8' }}>
          Gym tracker for Android · No ads, no accounts, no tracking
        </div>
      </div>
    </div>,
    size,
  )
}
