// Route handler for /manifest.webmanifest — PWA manifest
// Using a route handler avoids the Next.js dev server crash that occurs
// when manifest.json exists as a static file in public/

import { NextResponse } from 'next/server'

export async function GET() {
  const manifest = {
    name: 'GNECT',
    short_name: 'GNECT',
    description: 'No dating. No relationships. Just meet.',
    start_url: '/',
    display: 'standalone',
    background_color: '#111111',
    theme_color: '#25D366',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/logo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
