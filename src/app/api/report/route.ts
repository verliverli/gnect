import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { REPORT_REASONS, RATE_LIMITS } from "@/lib/constants"

// POST — Report a user
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { userId, reason, description } = body

    if (!userId || !reason) {
      return NextResponse.json(
        { ok: false, error: "userId and reason are required" },
        { status: 400 }
      )
    }

    // Validate reason
    const validReasons = REPORT_REASONS as readonly string[]
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { ok: false, error: `Invalid reason. Must be one of: ${REPORT_REASONS.join(", ")}` },
        { status: 400 }
      )
    }

    // Cannot report yourself
    if (userId === user.id) {
      return NextResponse.json({ ok: false, error: "Cannot report yourself" }, { status: 400 })
    }

    // Check if target user exists
    const targetUser = await db.user.findUnique({ where: { id: userId } })
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 })
    }

    // Cannot report the same user twice for the same reason
    const existingReport = await db.report.findFirst({
      where: {
        reporter_id: user.id,
        reported_user_id: userId,
        reason,
      },
    })

    if (existingReport) {
      return NextResponse.json(
        { ok: false, error: "You have already reported this user for this reason" },
        { status: 409 }
      )
    }

    // Create the report
    await db.report.create({
      data: {
        reporter_id: user.id,
        reported_user_id: userId,
        reason,
        description: description || null,
      },
    })

    // Auto-block: create a Block record so they can't see each other
    const existingBlock = await db.block.findUnique({
      where: {
        blocker_id_blocked_id: {
          blocker_id: user.id,
          blocked_id: userId,
        },
      },
    })

    if (!existingBlock) {
      await db.block.create({
        data: {
          blocker_id: user.id,
          blocked_id: userId,
        },
      })
    }

    // Auto-ban check: count unique users who have reported this person
    const uniqueReporters = await db.report.findMany({
      where: { reported_user_id: userId },
      select: { reporter_id: true },
      distinct: ["reporter_id"],
    })

    let banned = false

    if (uniqueReporters.length >= RATE_LIMITS.MAX_REPORTS_BEFORE_BAN) {
      await db.user.update({
        where: { id: userId },
        data: {
          is_banned: true,
          banned_reason: `Auto-banned: ${RATE_LIMITS.MAX_REPORTS_BEFORE_BAN}+ reports`,
        },
      })
      banned = true
    }

    return NextResponse.json({ ok: true, banned })
  } catch (error) {
    console.error("Report user error:", error)
    return NextResponse.json({ ok: false, error: "Failed to report user" }, { status: 500 })
  }
}
