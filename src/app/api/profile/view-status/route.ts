import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/profile/view-status — Track a status view + cleanup expired
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    // Increment view count on the target user's status
    const target = await db.user.findUnique({ where: { id: userId } })
    if (!target || !target.status_text) {
      return NextResponse.json({ ok: true, views: 0 })
    }

    // Check if status is expired — if so, clear it
    if (target.status_expires_at && new Date(target.status_expires_at) < new Date()) {
      await db.user.update({
        where: { id: userId },
        data: { status_text: null, status_gradient: null, status_expires_at: null },
      })
      return NextResponse.json({ ok: true, views: 0, expired: true })
    }

    // Increment view count
    await db.user.update({
      where: { id: userId },
      data: { status_views: { increment: 1 } },
    })

    return NextResponse.json({ ok: true, views: target.status_views + 1 })
  } catch (err) {
    console.error('View status error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
