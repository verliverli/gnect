// Service Worker route handler — serves /sw.js for push notifications
// Using a route handler avoids the Next.js dev server crash that occurs
// when sw.js exists as a static file in public/

import { NextResponse } from 'next/server'

const SW_CODE = `
// GNECT Service Worker — Push Notifications
const NOTIFICATION_ICON = '/icon-512.png'

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'New activity'
  const options = {
    body: data.body || 'Tap to open',
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    vibrate: [100, 50, 100],
    data: { url: data.data?.url || '/' },
    silent: false,
    requireInteraction: false,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.registration.options?.applicationServerKey,
    }).then((subscription) => {
      return fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: subscription.toJSON().keys,
        }),
      })
    })
  )
})
`

export async function GET() {
  return new NextResponse(SW_CODE, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
      'Service-Worker-Allowed': '/',
    },
  })
}
