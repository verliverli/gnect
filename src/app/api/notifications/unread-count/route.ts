import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/notifications/unread-count — Get unread notification count
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const count = await db.notification.count({
      where: { user_id: user.id, is_read: false },
    })

    return NextResponse.json({ ok: true, count })
  } catch (err) {
    console.error('Unread count error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
