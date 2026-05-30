import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/notifications/list — Get user's notifications
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get('cursor')
    const limit = parseInt(searchParams.get('limit') || '30')
    const type = searchParams.get('type') // optional filter

    const where: any = { user_id: user.id }
    if (type) where.type = type

    const notifications = await db.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = notifications.length > limit
    const data = hasMore ? notifications.slice(0, -1) : notifications
    const nextCursor = hasMore ? data[data.length - 1].id : null

    // Get unread count
    const unreadCount = await db.notification.count({
      where: { user_id: user.id, is_read: false },
    })

    return NextResponse.json({
      ok: true,
      data: data.map((n) => ({
        ...n,
        data: n.data ? JSON.parse(n.data) : null,
      })),
      nextCursor,
      unreadCount,
    })
  } catch (err) {
    console.error('List notifications error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
