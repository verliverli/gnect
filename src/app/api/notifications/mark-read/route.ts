import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/notifications/mark-read — Mark notifications as read
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { notificationId, markAll } = await req.json()

    if (markAll) {
      await db.notification.updateMany({
        where: { user_id: user.id, is_read: false },
        data: { is_read: true },
      })
    } else if (notificationId) {
      await db.notification.update({
        where: { id: notificationId, user_id: user.id },
        data: { is_read: true },
      })
    }

    const unreadCount = await db.notification.count({
      where: { user_id: user.id, is_read: false },
    })

    return NextResponse.json({ ok: true, unreadCount })
  } catch (err) {
    console.error('Mark read error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
