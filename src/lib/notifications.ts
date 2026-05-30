// ============================================
// GNECT Notification Helpers
// Create notifications + send push + real-time Socket.io
// ============================================

import { db } from './db'
import webpush from 'web-push'

// Configure web-push with VAPID
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:gnect@app.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
)

// Chat service URL for Socket.io emission (server-to-server)
// Production: HuggingFace Space (cloud relay). Dev: local chat-service on port 3003
const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || 'https://verliverli-gnect.hf.space'

interface CreateNotificationParams {
  userId: string
  type: string // "message" | "community" | "profile_view" | "profile_save" | "admin_broadcast" | "screenshot"
  title: string
  body: string
  data?: Record<string, any>
  isBroadcast?: boolean // If true, emit to all users via Socket.io
}

// Create an in-app notification and optionally send a push notification
export async function createNotification({ userId, type, title, body, data, isBroadcast }: CreateNotificationParams) {
  try {
    // Check user's notification settings
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { notification_settings: true },
    })

    if (!user) return

    const settings = (() => {
      try {
        return user.notification_settings ? JSON.parse(user.notification_settings) : null
      } catch {
        return null
      }
    })()

    // Check quiet hours
    if (settings?.quietHoursEnabled) {
      const now = new Date()
      const tzOffset = 3 * 60 // Tanzania UTC+3
      const localMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + tzOffset) % (24 * 60)
      const [startH, startM] = (settings.quietHoursStart || '23:00').split(':').map(Number)
      const [endH, endM] = (settings.quietHoursEnd || '07:00').split(':').map(Number)
      const startMinutes = startH * 60 + startM
      const endMinutes = endH * 60 + endM

      let inQuietHours = false
      if (startMinutes > endMinutes) {
        // e.g., 23:00 - 07:00 (crosses midnight)
        inQuietHours = localMinutes >= startMinutes || localMinutes < endMinutes
      } else {
        inQuietHours = localMinutes >= startMinutes && localMinutes < endMinutes
      }

      if (inQuietHours && type !== 'admin_broadcast') return // Don't push during quiet hours (except admin)
    }

    // Check if this notification type is enabled
    if (settings && type !== 'admin_broadcast') {
      const typeMap: Record<string, string> = {
        message: 'messages',
        community: 'community',
        profile_view: 'profileViews',
        profile_save: 'profileSaves',
        screenshot: 'messages',
      }
      const settingKey = typeMap[type]
      if (settingKey && !settings[settingKey]) return // User disabled this type
    }

    // Create in-app notification
    const notification = await db.notification.create({
      data: {
        user_id: userId,
        type,
        title,
        body,
        data: data ? JSON.stringify(data) : null,
      },
    })

    // Build the notification payload for Socket.io
    const socketPayload = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: data || null,
      is_read: false,
      created_at: notification.created_at.toISOString(),
    }

    // Emit real-time notification via Socket.io (fire-and-forget)
    if (isBroadcast) {
      emitSocketBroadcast(socketPayload).catch(() => {})
    } else {
      emitSocketNotification(userId, socketPayload).catch(() => {})
    }

    // Phase 6: Discreet Notifications — use user's preferred disguise style
    const discreetStyles: Record<string, { title: string; body: string }> = {
      default: { title: '🔔 New activity', body: 'Tap to open' },
      weather: { title: '🌤️ Weather update', body: 'You have 1 new update' },
      news: { title: '📰 News alert', body: 'You have 1 new update' },
      delivery: { title: '📦 Delivery update', body: 'You have 1 new update' },
    }
    const style = settings?.discreetNotifStyle || 'default'
    const discreetMsg = discreetStyles[style] || discreetStyles.default

    await sendPushNotification(userId, {
      title: discreetMsg.title,
      body: discreetMsg.body,
      data: data || {},
    })
  } catch (err) {
    console.error('Create notification error:', err)
  }
}

// Send a push notification to all of a user's devices
export async function sendPushNotification(userId: string, payload: { title: string; body: string; data: Record<string, any> }) {
  try {
    const subscriptions = await db.pushSubscription.findMany({
      where: { user_id: userId },
    })

    const pushPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payload)
        )
      } catch (err: any) {
        // If subscription is expired/gone, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.pushSubscription.delete({ where: { id: sub.id } })
        }
      }
    })

    await Promise.allSettled(pushPromises)
  } catch (err) {
    console.error('Push notification error:', err)
  }
}

// Batch notification — used when multiple events happen close together
// Instead of sending 5 notifications, send 1: "🔔 5 new activities"
// Uses a Map keyed by userId so concurrent users don't interfere with each other
const notificationBatches = new Map<string, { count: number; timer: ReturnType<typeof setTimeout> | null }>()

export function batchPushNotification(userId: string, delay = 3000) {
  const existing = notificationBatches.get(userId)

  if (existing) {
    existing.count++
    if (existing.timer) clearTimeout(existing.timer)
  } else {
    notificationBatches.set(userId, { count: 1, timer: null })
  }

  const batch = notificationBatches.get(userId)!
  batch.timer = setTimeout(async () => {
    if (batch.count > 0) {
      // Phase 6: Fetch discreet style for batch push
      let discreetTitle = '🔔 New activity'
      let discreetBody = 'Tap to open'
      try {
        const u = await db.user.findUnique({ where: { id: userId }, select: { notification_settings: true } })
        const s = u?.notification_settings ? JSON.parse(u.notification_settings) : {}
        const discreetStyles: Record<string, { title: string; body: string }> = {
          default: { title: '🔔 New activity', body: 'Tap to open' },
          weather: { title: '🌤️ Weather update', body: 'You have 1 new update' },
          news: { title: '📰 News alert', body: 'You have 1 new update' },
          delivery: { title: '📦 Delivery update', body: 'You have 1 new update' },
        }
        const dm = discreetStyles[s.discreetNotifStyle || 'default'] || discreetStyles.default
        discreetTitle = dm.title
        discreetBody = dm.body
      } catch {}

      sendPushNotification(userId, {
        title: discreetTitle,
        body: batch.count > 1 ? `${batch.count} new updates` : discreetBody,
        data: {},
      })
    }
    notificationBatches.delete(userId)
  }, delay)
}

// ============================================
// Socket.io Real-time Emission (Server-to-Server)
// Next.js backend → Chat service → User's browser
// ============================================

interface SocketNotificationPayload {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

// Emit a notification to a specific user via Socket.io
async function emitSocketNotification(userId: string, notification: SocketNotificationPayload): Promise<void> {
  try {
    const res = await fetch(`${CHAT_SERVICE_URL}/emit-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, notification }),
    })
    if (!res.ok) {
      console.error('[socket-emit] Failed to emit notification:', res.status)
    }
  } catch (err) {
    console.error('[socket-emit] Error emitting notification:', err)
  }
}

// Emit a broadcast notification to all online users via Socket.io
async function emitSocketBroadcast(notification: SocketNotificationPayload): Promise<void> {
  try {
    const res = await fetch(`${CHAT_SERVICE_URL}/emit-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification }),
    })
    if (!res.ok) {
      console.error('[socket-emit] Failed to emit broadcast:', res.status)
    }
  } catch (err) {
    console.error('[socket-emit] Error emitting broadcast:', err)
  }
}
