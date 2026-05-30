import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// POST /api/profile/[userId]/unlock — Unlock a locked photo with a secret phrase
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { userId } = await params

    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId is required" }, { status: 400 })
    }

    // Cannot unlock own photos
    if (userId === user.id) {
      return NextResponse.json({ ok: false, error: "Cannot unlock your own photos" }, { status: 400 })
    }

    // Parse body
    let body: { phrase?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 })
    }

    const { phrase } = body

    if (!phrase || typeof phrase !== "string" || !phrase.trim()) {
      return NextResponse.json({ ok: false, error: "Phrase is required" }, { status: 400 })
    }

    // Fetch target user's secret phrase
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        secret_phrase: true,
        is_banned: true,
      },
    })

    if (!targetUser) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 })
    }

    if (targetUser.is_banned) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 })
    }

    // Check if target user has a secret phrase set
    if (!targetUser.secret_phrase) {
      // No secret phrase required — photos can be unlocked freely
      return NextResponse.json({ ok: true, unlocked: true })
    }

    // Compare phrases (case-insensitive)
    const isMatch = phrase.trim().toLowerCase() === targetUser.secret_phrase.trim().toLowerCase()

    return NextResponse.json({ ok: true, unlocked: isMatch })
  } catch (error) {
    console.error("Unlock error:", error)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}
