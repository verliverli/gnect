import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// GET /api/discover/all — Fetch all users in Tanzania (no region filter, no filters except search)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const search = searchParams.get("search")
    const availability = searchParams.get("availability")
    const cursor = searchParams.get("cursor")
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 50)

    // Validate search parameter
    if (search && search.length > 20) {
      return NextResponse.json({ ok: false, error: "Search query too long (max 20 chars)" }, { status: 400 })
    }

    // Get blocked user IDs — users we blocked OR users who blocked us
    const blockedRecords = await db.block.findMany({
      where: {
        OR: [{ blocker_id: user.id }, { blocked_id: user.id }],
      },
      select: { blocker_id: true, blocked_id: true },
    })
    const blockedUserIds = new Set<string>()
    for (const b of blockedRecords) {
      if (b.blocker_id === user.id) blockedUserIds.add(b.blocked_id)
      if (b.blocked_id === user.id) blockedUserIds.add(b.blocker_id)
    }

    // Build where clause — visible users only, exclude self and blocked
    const where: Record<string, unknown> = {
      is_admin: false,
      is_banned: false,
      not_today: false,
      id: { notIn: [user.id, ...blockedUserIds] },
    }

    // Apply nickname search (case-insensitive partial match)
    if (search) {
      where.nickname = { contains: search, mode: "insensitive" }
    }

    // Apply availability filter
    if (availability) {
      where.availability = availability
    }

    // Count total matching users
    const total = await db.user.count({ where })

    // If no results, return early
    if (total === 0) {
      return NextResponse.json({ ok: true, data: [], nextCursor: null, total: 0 })
    }

    // Fetch users sorted by newest first with cursor-based pagination
    const users = await db.user.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        nickname: true,
        age: true,
        region: true,
        role: true,
        body_type: true,
        availability: true,
        is_online: true,
        last_seen: true,
        street: true,
        cucumber_size: true,
        show_cucumber: true,
        discretion_mode: true,
        status_text: true,
        status_gradient: true,
        created_at: true,
        photos: {
          select: { id: true, catbox_url: true, is_face_pic: true, is_locked: true },
          orderBy: { upload_order: "asc" },
        },
        into_tags: {
          select: { tag: true },
        },
      },
    })

    // Determine next cursor
    const hasNextPage = users.length > limit
    if (hasNextPage) users.length = limit
    const nextCursor = hasNextPage ? users[users.length - 1].id : null

    // Format response data (no is_saved for performance on the all endpoint)
    const data = users.map((u) => ({
      id: u.id,
      nickname: u.nickname,
      age: u.age,
      region: u.region,
      role: u.role,
      body_type: u.body_type,
      availability: u.availability,
      is_online: u.is_online,
      last_seen: u.last_seen,
      street: u.street,
      cucumber_size: u.show_cucumber ? u.cucumber_size : null,
      show_cucumber: u.show_cucumber,
      discretion_mode: u.discretion_mode,
      status_text: u.status_text,
      status_gradient: u.status_gradient,
      created_at: u.created_at,
      photos: u.photos,
      into_tags: u.into_tags.map((t: { tag: string }) => t.tag),
      is_saved: false, // Not computed for performance — can be added later
    }))

    return NextResponse.json({ ok: true, data, nextCursor, total })
  } catch (error) {
    console.error("Discover all error:", error)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}
