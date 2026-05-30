import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/broadcasts/active — Get active broadcasts for this user
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()

    const broadcasts = await db.adminBroadcast.findMany({
      where: {
        is_sent: true,
        expires_at: {
          gt: now,
        },
        target_region: {
          in: [user.region, ''],
        },
      },
      orderBy: { created_at: 'desc' },
      include: {
        acknowledgements: {
          where: { user_id: user.id },
          select: { id: true, acked_at: true },
        },
      },
    })

    // Also get broadcasts with null target_region (all regions)
    const globalBroadcasts = await db.adminBroadcast.findMany({
      where: {
        is_sent: true,
        expires_at: {
          gt: now,
        },
        target_region: null,
      },
      orderBy: { created_at: 'desc' },
      include: {
        acknowledgements: {
          where: { user_id: user.id },
          select: { id: true, acked_at: true },
        },
      },
    })

    // Merge and deduplicate
    const allBroadcasts = [...broadcasts, ...globalBroadcasts]
    const seen = new Set<string>()
    const unique = allBroadcasts.filter((b) => {
      if (seen.has(b.id)) return false
      seen.add(b.id)
      return true
    })

    const result = unique.map((b) => ({
      id: b.id,
      title: b.title,
      message: b.message,
      level: b.level,
      action_label: b.action_label,
      action_url: b.action_url,
      created_at: b.created_at,
      is_acknowledged: b.acknowledgements.length > 0,
    }))

    // Separate urgent (unacknowledged) from info
    const urgent = result.filter((b) => b.level === 'urgent' && !b.is_acknowledged)
    const info = result.filter((b) => b.level === 'info' || b.is_acknowledged)

    return NextResponse.json({ ok: true, urgent, info })
  } catch (err) {
    console.error('Active broadcasts error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
