import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { createNotification } from "@/lib/notifications"

// POST — Save/bookmark a profile
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId is required" }, { status: 400 })
    }

    if (userId === user.id) {
      return NextResponse.json({ ok: false, error: "Cannot save yourself" }, { status: 400 })
    }

    // Check if target user exists
    const targetUser = await db.user.findUnique({ where: { id: userId } })
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 })
    }

    // Check if already saved
    const existing = await db.savedProfile.findUnique({
      where: {
        user_id_saved_user_id: {
          user_id: user.id,
          saved_user_id: userId,
        },
      },
    })

    if (existing) {
      return NextResponse.json({ ok: false, error: "Profile already saved" }, { status: 409 })
    }

    await db.savedProfile.create({
      data: {
        user_id: user.id,
        saved_user_id: userId,
      },
    })

    // Send profile save notification
    createNotification({
      userId: userId,
      type: 'profile_save',
      title: '🔖 Profile saved',
      body: 'Someone saved your profile',
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Save profile error:", error)
    return NextResponse.json({ ok: false, error: "Failed to save profile" }, { status: 500 })
  }
}

// DELETE — Remove saved profile
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId is required" }, { status: 400 })
    }

    const existing = await db.savedProfile.findUnique({
      where: {
        user_id_saved_user_id: {
          user_id: user.id,
          saved_user_id: userId,
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Saved profile not found" }, { status: 404 })
    }

    await db.savedProfile.delete({
      where: {
        user_id_saved_user_id: {
          user_id: user.id,
          saved_user_id: userId,
        },
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Unsave profile error:", error)
    return NextResponse.json({ ok: false, error: "Failed to unsave profile" }, { status: 500 })
  }
}

// GET — List all saved profiles for the authenticated user
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const savedProfiles = await db.savedProfile.findMany({
      where: { user_id: user.id },
      include: {
        saved: {
          select: {
            id: true,
            nickname: true,
            age: true,
            region: true,
            role: true,
            availability: true,
            is_online: true,
            last_seen: true,
            photos: {
              select: {
                id: true,
                catbox_url: true,
                is_locked: true,
                is_face_pic: true,
                upload_order: true,
              },
              orderBy: { upload_order: "asc" },
            },
            into_tags: {
              select: { tag: true },
            },
          },
        },
      },
      orderBy: { created_at: "desc" },
    })

    const data = savedProfiles.map((sp) => ({
      ...sp.saved,
      into_tags: sp.saved.into_tags.map((t) => t.tag),
    }))

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error("Get saved profiles error:", error)
    return NextResponse.json({ ok: false, error: "Failed to get saved profiles" }, { status: 500 })
  }
}
