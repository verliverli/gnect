import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// Chat service URL for Socket.io emission (server-to-server)
// Production: HuggingFace Space (cloud relay). Dev: local chat-service on port 3003
const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || 'https://verliverli-gnect.hf.space'

// POST /api/admin/broadcast — Create a new broadcast (admin only)
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!user.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

    const { title, message, level, target_region, action_label, action_url, scheduled_at } = await req.json()

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message required' }, { status: 400 })
    }

    const scheduledDate = scheduled_at ? new Date(scheduled_at) : null
    const isImmediate = !scheduledDate || scheduledDate <= new Date()

    const broadcast = await db.adminBroadcast.create({
      data: {
        admin_id: user.id,
        title,
        message,
        level: level || 'info',
        target_region: target_region || null,
        action_label: action_label || null,
        action_url: action_url || null,
        scheduled_at: scheduledDate,
        is_sent: isImmediate,
        sent_at: isImmediate ? new Date() : null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
      },
    })

    // If immediate, create notification records for all users
    if (isImmediate) {
      const allUsers = await db.user.findMany({
        where: {
          is_banned: false,
          is_admin: false,
          ...(target_region ? { region: target_region } : {}),
        },
        select: { id: true },
      })

      if (allUsers.length > 0) {
        await db.notification.createMany({
          data: allUsers.map((u) => ({
            user_id: u.id,
            type: 'admin_broadcast',
            title: '🔔 Admin Notice',
            body: message.slice(0, 100),
            data: JSON.stringify({ broadcastId: broadcast.id, level }),
          })),
        })

        // Emit real-time broadcast via Socket.io to all online users
        const socketPayload = {
          id: broadcast.id,
          type: 'admin_broadcast',
          title: '🔔 Admin Notice',
          body: message.slice(0, 100),
          data: { broadcastId: broadcast.id, level },
          is_read: false,
          created_at: broadcast.created_at.toISOString(),
        }
        fetch(`${CHAT_SERVICE_URL}/emit-broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification: socketPayload }),
        }).catch(() => {}) // Fire-and-forget
      }
    }

    return NextResponse.json({ ok: true, data: broadcast })
  } catch (err) {
    console.error('Create broadcast error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// GET /api/admin/broadcast — List all broadcasts (admin only)
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!user.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

    const broadcasts = await db.adminBroadcast.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { acknowledgements: true } },
      },
    })

    // Get total user count for analytics
    const totalUsers = await db.user.count({ where: { is_banned: false, is_admin: false } })

    const data = broadcasts.map((b) => ({
      ...b,
      ack_count: b._count.acknowledgements,
      total_users: totalUsers,
    }))

    return NextResponse.json({ ok: true, data })
  } catch (err) {
    console.error('List broadcasts error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
