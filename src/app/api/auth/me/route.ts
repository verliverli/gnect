import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    // Check if user is banned (getCurrentUser already checks this, but double-check for API response)
    if (user.is_banned) {
      return NextResponse.json({ ok: false, error: "This account has been suspended" }, { status: 403 })
    }

    // Update last_seen and online status (heartbeat)
    await db.user.update({
      where: { id: user.id },
      data: { last_seen: new Date(), is_online: true },
    })

    return NextResponse.json({ ok: true, user })
  } catch (error) {
    console.error("Me error:", error)
    return NextResponse.json({ ok: false, error: "Failed to get user" }, { status: 500 })
  }
}
