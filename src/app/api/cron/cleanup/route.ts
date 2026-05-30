import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/cron/cleanup — Cleanup expired data
// Called periodically (e.g., every 15 minutes by a cron service)
export async function GET() {
  try {
    const now = new Date()

    // ===== 1. Clear expired statuses =====
    // Find users with expired status and clear them
    const usersWithExpiredStatus = await db.user.findMany({
      where: {
        status_expires_at: { lt: now },
        NOT: { status_text: null },
      },
      select: { id: true },
    })
    let expiredStatuses = 0
    if (usersWithExpiredStatus.length > 0) {
      const result = await db.user.updateMany({
        where: {
          id: { in: usersWithExpiredStatus.map(u => u.id) },
        },
        data: {
          status_text: null,
          status_gradient: null,
          status_expires_at: null,
          status_views: 0,
        },
      })
      expiredStatuses = result.count
    }

    // ===== 2. Delete expired messages (auto_delete_at) =====
    // This handles: unopened media (30 min), opened media (24h), view-once after timer
    const expiredAutoDelete = await db.message.deleteMany({
      where: {
        NOT: { auto_delete_at: null },
        auto_delete_at: { lt: now },
      },
    })

    // ===== 3. Delete expired messages (hard_delete_at) =====
    // This is the 7-day hard limit — catches everything including text
    const expiredHardDelete = await db.message.deleteMany({
      where: {
        NOT: { hard_delete_at: null },
        hard_delete_at: { lt: now },
      },
    })

    // ===== 4. Delete old notifications (older than 30 days) =====
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const deletedNotifications = await db.notification.deleteMany({
      where: { created_at: { lt: thirtyDaysAgo } },
    })

    // ===== 5. Delete expired admin broadcasts =====
    const expiredBroadcasts = await db.adminBroadcast.deleteMany({
      where: {
        NOT: { expires_at: null },
        expires_at: { lt: now },
      },
    })

    // ===== 6. Delete expired community posts + comments (7-day auto-delete) =====
    // auto_delete_at is required (non-nullable) on these models, so no null check needed
    const expiredPosts = await db.communityPost.deleteMany({
      where: {
        auto_delete_at: { lt: now },
        is_deleted: false,
      },
    })

    const expiredComments = await db.postComment.deleteMany({
      where: {
        auto_delete_at: { lt: now },
        is_deleted: false,
      },
    })

    // ===== 7. Clean up expired rate limits =====
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const expiredRateLimits = await db.rateLimit.deleteMany({
      where: { hour_window_start: { lt: oneHourAgo } },
    })

    // ===== 8. Reset not_today for expired users =====
    const usersWithExpiredNotToday = await db.user.findMany({
      where: {
        not_today: true,
        NOT: { not_today_expires: null },
        not_today_expires: { lt: now },
      },
      select: { id: true },
    })
    let resetNotToday = 0
    if (usersWithExpiredNotToday.length > 0) {
      const result = await db.user.updateMany({
        where: {
          id: { in: usersWithExpiredNotToday.map(u => u.id) },
        },
        data: {
          not_today: false,
          not_today_expires: null,
        },
      })
      resetNotToday = result.count
    }

    return NextResponse.json({
      ok: true,
      expiredStatuses,
      expiredAutoDeleteMessages: expiredAutoDelete.count,
      expiredHardDeleteMessages: expiredHardDelete.count,
      deletedNotifications: deletedNotifications.count,
      expiredBroadcasts: expiredBroadcasts.count,
      expiredPosts: expiredPosts.count,
      expiredComments: expiredComments.count,
      expiredRateLimits: expiredRateLimits.count,
      resetNotToday,
    })
  } catch (err) {
    console.error('Cleanup error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
