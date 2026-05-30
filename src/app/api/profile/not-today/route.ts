import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser, hasPremiumAccess } from "@/lib/auth"
import { RATE_LIMITS } from "@/lib/constants"

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { activate } = body
    const isPremium = hasPremiumAccess(user)

    // Deactivating — always allowed
    if (!activate) {
      const updated = await db.user.update({
        where: { id: user.id },
        data: { not_today: false, not_today_expires: null },
        select: {
          id: true, not_today: true, not_today_expires: true,
          not_today_count: true, not_today_reset: true,
        },
      })
      return NextResponse.json({ ok: true, data: updated })
    }

    // Activating — check limits for free users
    if (!isPremium) {
      const now = new Date()
      const resetTime = new Date(user.not_today_reset)

      // Reset counter if past the reset window
      if (now > resetTime) {
        await db.user.update({
          where: { id: user.id },
          data: { not_today_count: 0, not_today_reset: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
        })
      } else {
        // Within current window — check count
        if (user.not_today_count >= RATE_LIMITS.FREE_NOT_TODAY_PER_DAY) {
          return NextResponse.json(
            { ok: false, error: "Daily Not Today limit reached (1/day for free users)" },
            { status: 429 }
          )
        }
      }
    }

    // Activate Not Today mode — expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        not_today: true,
        not_today_expires: expiresAt,
        not_today_count: { increment: 1 },
      },
      select: {
        id: true, not_today: true, not_today_expires: true,
        not_today_count: true, not_today_reset: true,
      },
    })

    return NextResponse.json({ ok: true, data: updated })
  } catch (error) {
    console.error("Not Today toggle error:", error)
    return NextResponse.json({ ok: false, error: "Failed to toggle Not Today" }, { status: 500 })
  }
}
