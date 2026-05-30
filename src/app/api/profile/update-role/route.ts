import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser, hasPremiumAccess } from "@/lib/auth"
import { ROLES, RATE_LIMITS } from "@/lib/constants"

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { role } = body

    // Validate role
    if (!role || typeof role !== "string" || !ROLES.includes(role as typeof ROLES[number])) {
      return NextResponse.json({ ok: false, error: "Invalid role" }, { status: 400 })
    }

    // Same role — no change needed
    if (user.role === role) {
      return NextResponse.json({ ok: true, data: user })
    }

    // Check cooldown period since last change
    if (user.role_last_changed) {
      const isPremium = hasPremiumAccess(user)
      const cooldownDays = isPremium
        ? RATE_LIMITS.ROLE_CHANGE_PREMIUM_DAYS
        : RATE_LIMITS.ROLE_CHANGE_FREE_DAYS

      const lastChanged = new Date(user.role_last_changed)
      const nextAllowed = new Date(lastChanged.getTime() + cooldownDays * 24 * 60 * 60 * 1000)

      if (new Date() < nextAllowed) {
        const daysLeft = Math.ceil((nextAllowed.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        return NextResponse.json(
          { ok: false, error: `Role change available in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}` },
          { status: 429 }
        )
      }
    }

    // Update role and record change time
    const updated = await db.user.update({
      where: { id: user.id },
      data: { role, role_last_changed: new Date() },
      select: {
        id: true, nickname: true, age: true, region: true, bio: true,
        height: true, weight: true, body_type: true, role: true,
        role_last_changed: true, availability: true, discretion_mode: true,
        secret_phrase: true, not_today: true, not_today_expires: true,
        is_premium: true, is_premium_free: true, is_early_adopter: true,
        is_admin: true, is_online: true, last_seen: true, created_at: true, updated_at: true,
      },
    })

    return NextResponse.json({ ok: true, data: updated })
  } catch (error) {
    console.error("Update role error:", error)
    return NextResponse.json({ ok: false, error: "Failed to update role" }, { status: 500 })
  }
}
