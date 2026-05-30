// ============================================
// GNECT Community — Daily Post Count
// GET /api/community/daily-count — Check today's post count for current user
// ============================================

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

const DAILY_POST_LIMIT = 5

/** Return the start of today as a Date (midnight local time) */
function startOfToday(): Date {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const todayStart = startOfToday()

    // Count today's non-deleted posts by this user
    const count = await db.communityPost.count({
      where: {
        user_id: user.id,
        created_at: { gte: todayStart },
        is_deleted: false,
      },
    })

    return NextResponse.json({
      ok: true,
      count,
      limit: DAILY_POST_LIMIT,
    })
  } catch (error) {
    console.error("Community daily count error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to get daily count" },
      { status: 500 }
    )
  }
}
