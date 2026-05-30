import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const tags = await db.intoTag.findMany({
      where: { user_id: user.id },
      select: { tag: true },
    })

    return NextResponse.json({ ok: true, data: tags.map((t) => t.tag) })
  } catch (error) {
    console.error("Get tags error:", error)
    return NextResponse.json({ ok: false, error: "Failed to get tags" }, { status: 500 })
  }
}
