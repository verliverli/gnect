import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/profile/photos — Get current user's own photos
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const photos = await db.profilePhoto.findMany({
      where: { user_id: user.id },
      orderBy: { upload_order: "asc" },
      select: {
        id: true,
        catbox_url: true,
        is_face_pic: true,
        is_locked: true,
        upload_order: true,
      },
    })

    return NextResponse.json({ ok: true, data: photos })
  } catch (error) {
    console.error("Get photos error:", error)
    return NextResponse.json({ ok: false, error: "Failed to get photos" }, { status: 500 })
  }
}
