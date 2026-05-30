// ============================================
// GNECT CHECK NICKNAME AVAILABILITY API
// GET /api/auth/check-nickname?nickname=xxx
// ============================================

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { validateNickname } from "@/lib/validation"

export async function GET(request: NextRequest) {
  const nickname = request.nextUrl.searchParams.get("nickname")

  if (!nickname) {
    return NextResponse.json(
      { available: false, error: "Nickname is required" },
      { status: 400 }
    )
  }

  // Validate format first
  const validation = validateNickname(nickname)
  if (!validation.valid) {
    return NextResponse.json(
      { available: false, error: validation.error },
      { status: 200 }
    )
  }

  // Check uniqueness in database
  const existing = await db.user.findUnique({
    where: { nickname },
    select: { id: true },
  })

  return NextResponse.json({ available: !existing })
}
