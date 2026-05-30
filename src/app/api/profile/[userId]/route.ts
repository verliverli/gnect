import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { createNotification } from "@/lib/notifications"

// GET /api/profile/[userId] — Fetch another user's public profile for Spotlight view
export async function GET(
  _request: NextRequest,
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

    // Cannot view own profile via this endpoint
    if (userId === user.id) {
      return NextResponse.json({ ok: false, error: "Use /api/auth/me for your own profile" }, { status: 400 })
    }

    // Fetch target user — exclude sensitive fields
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        age: true,
        region: true,
        bio: true,
        height: true,
        weight: true,
        body_type: true,
        role: true,
        availability: true,
        discretion_mode: true,
        secret_phrase: true, // Needed to compute has_secret_phrase, but NOT returned
        not_today: true,
        is_online: true,
        last_seen: true,
        street: true,
        cucumber_size: true,
        show_cucumber: true,
        status_text: true,
        status_gradient: true,
        status_expires_at: true,
        created_at: true,
        is_banned: true,
        is_admin: true,
        photos: {
          select: {
            id: true,
            catbox_url: true,
            is_face_pic: true,
            is_locked: true,
          },
          orderBy: { upload_order: "asc" },
        },
        into_tags: {
          select: { tag: true },
        },
      },
    })

    if (!targetUser) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 })
    }

    // Never show banned users
    if (targetUser.is_banned) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 })
    }

    // Never show admin users in spotlight
    if (targetUser.is_admin) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 })
    }

    // Check if current user has saved this profile
    const savedRecord = await db.savedProfile.findUnique({
      where: {
        user_id_saved_user_id: {
          user_id: user.id,
          saved_user_id: userId,
        },
      },
    })

    // Check block status (both directions)
    const blockRecord = await db.block.findFirst({
      where: {
        OR: [
          { blocker_id: user.id, blocked_id: userId },
          { blocker_id: userId, blocked_id: user.id },
        ],
      },
    })
    const is_blocked = !!blockRecord

    // Format photos — flag face pics when discretion_mode is on (frontend handles blur)
    const photos = targetUser.photos.map((p) => ({
      id: p.id,
      catbox_url: p.catbox_url,
      is_face_pic: p.is_face_pic,
      is_locked: p.is_locked,
      // Frontend can use discretion_mode + is_face_pic to apply blur
      // Frontend can use is_locked + has_secret_phrase to require phrase unlock
    }))

    // Build response — NEVER include password_hash, secret_phrase value, or admin-only fields
    const data = {
      id: targetUser.id,
      nickname: targetUser.nickname,
      age: targetUser.age,
      region: targetUser.region,
      bio: targetUser.bio,
      height: targetUser.height,
      weight: targetUser.weight,
      body_type: targetUser.body_type,
      role: targetUser.role,
      availability: targetUser.availability,
      discretion_mode: targetUser.discretion_mode,
      has_secret_phrase: !!targetUser.secret_phrase, // Boolean only, never the actual phrase
      street: targetUser.street,
      cucumber_size: targetUser.show_cucumber ? targetUser.cucumber_size : null,
      show_cucumber: targetUser.show_cucumber,
      status_text: targetUser.status_text,
      status_gradient: targetUser.status_gradient,
      is_online: targetUser.is_online,
      last_seen: targetUser.last_seen,
      created_at: targetUser.created_at,
      photos,
      into_tags: targetUser.into_tags.map((t) => t.tag),
      is_saved: !!savedRecord,
      is_blocked,
    }

    // Send profile view notification (async, don't block response)
    createNotification({
      userId: userId,
      type: 'profile_view',
      title: '👁️ Profile viewed',
      body: 'Someone checked out your profile',
    }).catch(() => {})

    // Track status view + cleanup expired statuses (direct DB call, not HTTP fetch)
    if (targetUser.status_text) {
      // Check if status is expired — if so, clear it
      if (targetUser.status_expires_at && new Date(targetUser.status_expires_at) < new Date()) {
        db.user.update({
          where: { id: userId },
          data: { status_text: null, status_gradient: null, status_expires_at: null },
        }).catch(() => {})
      } else {
        // Increment view count
        db.user.update({
          where: { id: userId },
          data: { status_views: { increment: 1 } },
        }).catch(() => {})
      }
    }

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error("Profile fetch error:", error)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}