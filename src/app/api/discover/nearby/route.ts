import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { ROLES, BODY_TYPES, AVAILABILITY_STATUSES, INTO_TAGS } from "@/lib/constants"

// GET /api/discover/nearby — Fetch users in the same region as the authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Parse and validate query parameters
    const roleParams = searchParams.getAll("role") // supports multiple roles
    const ageMin = Math.max(parseInt(searchParams.get("ageMin") || "18"), 18)
    const ageMax = Math.min(parseInt(searchParams.get("ageMax") || "120"), 120)
    const street = searchParams.get("street")
    const availability = searchParams.get("availability")
    const bodyTypeParams = searchParams.getAll("bodyType") // supports multiple body types
    const tagParam = searchParams.get("tag")
    const sort = searchParams.get("sort") || "nearby"
    const cursor = searchParams.get("cursor")
    const onlineOnly = searchParams.get("onlineOnly") === "true"
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 50)

    // Validate role filters
    const validRoles = roleParams.filter((r) => ROLES.includes(r as typeof ROLES[number]))
    // Validate body type filters
    const validBodyTypes = bodyTypeParams.filter((b) => BODY_TYPES.includes(b as typeof BODY_TYPES[number]))
    // Validate availability
    if (availability && !AVAILABILITY_STATUSES.includes(availability as typeof AVAILABILITY_STATUSES[number])) {
      return NextResponse.json({ ok: false, error: "Invalid availability filter" }, { status: 400 })
    }
    if (!["nearby", "available_now", "newest", "online"].includes(sort)) {
      return NextResponse.json({ ok: false, error: "Invalid sort option" }, { status: 400 })
    }
    if (ageMin > ageMax) {
      return NextResponse.json({ ok: false, error: "ageMin cannot exceed ageMax" }, { status: 400 })
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

    // Build base where clause — same region, visible users only
    const where: Record<string, unknown> = {
      region: user.region,
      is_admin: false,
      is_banned: false,
      not_today: false,
      age: { gte: ageMin, lte: ageMax },
    }

    // Apply optional filters — multiple roles
    if (validRoles.length === 1) {
      where.role = validRoles[0]
    } else if (validRoles.length > 1) {
      where.role = { in: validRoles }
    }

    // Multiple body types
    if (validBodyTypes.length === 1) {
      where.body_type = validBodyTypes[0]
    } else if (validBodyTypes.length > 1) {
      where.body_type = { in: validBodyTypes }
    }

    if (availability) where.availability = availability
    if (street) where.street = street
    if (onlineOnly) where.is_online = true

    // Build excluded IDs (self + blocked users)
    const excludeIds = [user.id, ...blockedUserIds]

    // Tag filter — subquery: find user IDs that have ANY of the specified tags
    if (tagParam) {
      const tags = tagParam
        .split(",")
        .map((t) => t.trim())
        .filter((t) => INTO_TAGS.includes(t as typeof INTO_TAGS[number]))

      if (tags.length > 0) {
        const tagRecords = await db.intoTag.findMany({
          where: { tag: { in: tags } },
          select: { user_id: true },
        })
        const tagUserIds = [...new Set(tagRecords.map((r) => r.user_id))]
        // Combine with exclusion list (self + blocked)
        where.id = { in: tagUserIds.filter((id) => !excludeIds.includes(id)) }
      } else {
        // No valid tags = no results
        where.id = { in: [] }
      }
    } else {
      where.id = { notIn: excludeIds }
    }

    // Count total matching users
    const total = await db.user.count({ where })

    // If no results, return early
    if (total === 0) {
      return NextResponse.json({ ok: true, data: [], nextCursor: null, total: 0 })
    }

    // Fetch matching users — we use in-memory sorting for custom orderings
    // that Prisma cannot express (e.g., "same street first")
    const allUsers = await db.user.findMany({
      where,
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

    // Sort in memory based on sort option
    if (sort === "nearby") {
      // Same street first, then by last_seen DESC
      const myStreet = user.street
      allUsers.sort((a, b) => {
        const aSame = a.street && myStreet && a.street === myStreet ? 0 : 1
        const bSame = b.street && myStreet && b.street === myStreet ? 0 : 1
        if (aSame !== bSame) return aSame - bSame
        return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
      })
    } else if (sort === "available_now") {
      // "Available Now" first, then by last_seen DESC
      allUsers.sort((a, b) => {
        const aAvail = a.availability === "Available Now" ? 0 : 1
        const bAvail = b.availability === "Available Now" ? 0 : 1
        if (aAvail !== bAvail) return aAvail - bAvail
        return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
      })
    } else if (sort === "online") {
      // Online first, then by last_seen DESC
      allUsers.sort((a, b) => {
        if (a.is_online !== b.is_online) return a.is_online ? -1 : 1
        return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
      })
    } else {
      // newest — created_at DESC
      allUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    // Cursor-based pagination — find cursor position and skip past it
    let startIndex = 0
    if (cursor) {
      const cursorIdx = allUsers.findIndex((u) => u.id === cursor)
      if (cursorIdx !== -1) {
        startIndex = cursorIdx + 1
      }
      // If cursor not found, start from beginning (graceful fallback)
    }

    const paginated = allUsers.slice(startIndex, startIndex + limit + 1)
    const hasNextPage = paginated.length > limit
    if (hasNextPage) paginated.length = limit
    const nextCursor = hasNextPage ? paginated[paginated.length - 1].id : null

    // Fetch saved profile status for current user
    const userIds = paginated.map((u) => u.id)
    const savedProfiles =
      userIds.length > 0
        ? await db.savedProfile.findMany({
            where: { user_id: user.id, saved_user_id: { in: userIds } },
            select: { saved_user_id: true },
          })
        : []
    const savedUserIds = new Set(savedProfiles.map((s) => s.saved_user_id))

    // Format response data
    const data = paginated.map((u) => ({
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
      is_saved: savedUserIds.has(u.id),
    }))

    return NextResponse.json({ ok: true, data, nextCursor, total })
  } catch (error) {
    console.error("Discover nearby error:", error)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}
