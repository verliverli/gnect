import { NextRequest, NextResponse } from "next/server"
import { clearSessionCookie, getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    // Update user online status before clearing cookie
    const user = await getCurrentUser()
    if (user) {
      await db.user.update({
        where: { id: user.id },
        data: { is_online: false, last_seen: new Date() },
      })
    }
    
    await clearSessionCookie()
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json({ ok: false, error: "Logout failed" }, { status: 500 })
  }
}
