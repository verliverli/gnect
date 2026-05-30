// ============================================
// GNECT Community — Posts List & Create
// GET  /api/community/posts  — List posts (paginated, anonymous)
// POST /api/community/posts  — Create a new anonymous post
// ============================================

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { checkActionRateLimit, incrementActionRateLimit } from "@/lib/rate-limit"
import { containsLink } from "@/lib/constants"

const DAILY_POST_LIMIT = 5
const PAGE_SIZE = 20
const VALID_CATEGORIES = ["SFW", "NSFW"] as const
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/** Return the start of today as a Date (midnight local time) */
function startOfToday(): Date {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now
}

// -------------------------------------------
// POST /api/community/posts — Create post
// -------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    // Admin cannot create community posts (admin is for work, not hookup)
    if (user.is_admin) {
      return NextResponse.json(
        { ok: false, error: "Admins cannot create community posts" },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { content, category, region_tag } = body

    // Validate content (1–2000 chars)
    if (!content || typeof content !== "string" || content.trim().length < 1) {
      return NextResponse.json(
        { ok: false, error: "Content is required" },
        { status: 400 }
      )
    }
    if (content.length > 2000) {
      return NextResponse.json(
        { ok: false, error: "Content must be 2000 characters or less" },
        { status: 400 }
      )
    }

    // Block links (phishing, spam, doxxing)
    if (containsLink(content)) {
      return NextResponse.json(
        { ok: false, error: "Links are not allowed in posts" },
        { status: 400 }
      )
    }

    // Validate category
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { ok: false, error: "Category must be 'SFW' or 'NSFW'" },
        { status: 400 }
      )
    }

    // Check daily post limit — count today's non-deleted posts by this user
    const todayStart = startOfToday()
    const todayPostCount = await db.communityPost.count({
      where: {
        user_id: user.id,
        created_at: { gte: todayStart },
        is_deleted: false,
      },
    })

    if (todayPostCount >= DAILY_POST_LIMIT) {
      return NextResponse.json(
        { ok: false, error: `Daily post limit reached (${DAILY_POST_LIMIT}/day)` },
        { status: 429 }
      )
    }

    // Also enforce hourly rate limit as a secondary throttle
    const withinHourlyLimit = await checkActionRateLimit(user.id, "community_post")
    if (!withinHourlyLimit) {
      return NextResponse.json(
        { ok: false, error: "Slow down — you're posting too frequently" },
        { status: 429 }
      )
    }

    // Set auto_delete_at = 7 days from now
    const autoDeleteAt = new Date(Date.now() + SEVEN_DAYS_MS)

    // Create the post
    const post = await db.communityPost.create({
      data: {
        user_id: user.id,
        content: content.trim(),
        category,
        region_tag: region_tag || null,
        auto_delete_at: autoDeleteAt,
      },
    })

    // Increment hourly rate limit counter
    await incrementActionRateLimit(user.id, "community_post")

    // Return created post (no user_id exposed — anonymity)
    return NextResponse.json({
      ok: true,
      post: {
        id: post.id,
        content: post.content,
        category: post.category,
        region_tag: post.region_tag,
        upvotes_count: post.upvotes_count,
        comments_count: post.comments_count,
        auto_delete_at: post.auto_delete_at.toISOString(),
        created_at: post.created_at.toISOString(),
        is_own: true,
        has_upvoted: false,
      },
    }, { status: 201 })
  } catch (error) {
    console.error("Community post create error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to create post" },
      { status: 500 }
    )
  }
}

// -------------------------------------------
// GET /api/community/posts — List posts
// Query params: tab ("new"|"hot"|"my"), category ("SFW"|"NSFW"|"all"), cursor, limit
// -------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tab = searchParams.get("tab") || "new"
    const category = searchParams.get("category") || "all"
    const cursorParam = searchParams.get("cursor") || null
    const limitParam = parseInt(searchParams.get("limit") || String(PAGE_SIZE), 10)
    const limit = Math.min(Math.max(limitParam, 1), 50)

    const now = new Date()

    // Base filters — exclude deleted and auto-expired posts
    const baseWhere: Record<string, unknown> = {
      is_deleted: false,
      auto_delete_at: { gte: now },
    }

    // Category filter
    if (category === "SFW" || category === "NSFW") {
      baseWhere.category = category
    }

    // "My Posts" tab — only current user's posts
    if (tab === "my") {
      baseWhere.user_id = user.id
    }

    // Cursor-based pagination
    // For "hot" tab: cursor format = "created_at_iso::upvotes_count"
    // For "new"/"my" tab: cursor = created_at ISO string
    if (cursorParam) {
      if (tab === "hot" && cursorParam.includes("::")) {
        const [createdAtStr, upvotesStr] = cursorParam.split("::")
        const cursorCreatedAt = new Date(createdAtStr)
        const cursorUpvotes = parseInt(upvotesStr, 10)
        baseWhere.OR = [
          { upvotes_count: { lt: cursorUpvotes } },
          { upvotes_count: cursorUpvotes, created_at: { lt: cursorCreatedAt } },
        ]
      } else {
        // "new" or "my" tab — simple created_at cursor
        baseWhere.created_at = { lt: new Date(cursorParam) }
      }
    }

    // Determine sort order
    const orderBy =
      tab === "hot"
        ? [{ upvotes_count: "desc" as const }, { created_at: "desc" as const }]
        : [{ created_at: "desc" as const }]

    // Fetch one extra to detect next page
    const posts = await db.communityPost.findMany({
      where: baseWhere,
      orderBy,
      take: limit + 1,
      select: {
        id: true,
        content: true,
        category: true,
        region_tag: true,
        upvotes_count: true,
        comments_count: true,
        auto_delete_at: true,
        created_at: true,
        user_id: true, // kept for is_own check, stripped from response
        upvotes: {
          where: { user_id: user.id },
          select: { id: true },
        },
      },
    })

    const hasNextPage = posts.length > limit
    if (hasNextPage) posts.length = limit

    // Build next cursor
    const lastPost = posts[posts.length - 1]
    const nextCursor = hasNextPage
      ? tab === "hot"
        ? `${lastPost.created_at.toISOString()}::${lastPost.upvotes_count}`
        : lastPost.created_at.toISOString()
      : null

    // Format response — strip user_id for anonymity, add is_own + has_upvoted
    const data = posts.map((post) => ({
      id: post.id,
      content: post.content,
      category: post.category,
      region_tag: post.region_tag,
      upvotes_count: post.upvotes_count,
      comments_count: post.comments_count,
      auto_delete_at: post.auto_delete_at.toISOString(),
      created_at: post.created_at.toISOString(),
      is_own: post.user_id === user.id,
      has_upvoted: post.upvotes.length > 0,
    }))

    return NextResponse.json({ ok: true, data, nextCursor })
  } catch (error) {
    console.error("Community posts list error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to fetch posts" },
      { status: 500 }
    )
  }
}
