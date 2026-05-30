// ============================================
// GNECT Community — Report Post
// POST /api/community/posts/[postId]/report — Report a post
// ============================================

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

const VALID_REPORT_REASONS = ["Spam", "Harassment", "Underage", "Illegal", "Other"] as const

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { postId } = await params

    // Verify the post exists, is not deleted, and hasn't auto-expired
    const post = await db.communityPost.findUnique({
      where: { id: postId },
      select: { id: true, is_deleted: true, auto_delete_at: true },
    })

    if (!post || post.is_deleted || post.auto_delete_at < new Date()) {
      return NextResponse.json(
        { ok: false, error: "Post not found" },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { reason } = body

    // Validate reason
    if (!reason || typeof reason !== "string") {
      return NextResponse.json(
        { ok: false, error: "Reason is required" },
        { status: 400 }
      )
    }

    // Accept exact match or "Other: ..." prefix for custom descriptions
    const isKnownReason = VALID_REPORT_REASONS.includes(reason as typeof VALID_REPORT_REASONS[number])
    const isOtherWithDescription = reason.startsWith("Other: ")
    if (!isKnownReason && !isOtherWithDescription) {
      return NextResponse.json(
        {
          ok: false,
          error: `Reason must be one of: ${VALID_REPORT_REASONS.join(", ")}`,
        },
        { status: 400 }
      )
    }

    // Check if user already reported this post (unique constraint on post_id + reporter_id)
    const existingReport = await db.postReport.findUnique({
      where: {
        post_id_reporter_id: {
          post_id: postId,
          reporter_id: user.id,
        },
      },
    })

    if (existingReport) {
      return NextResponse.json(
        { ok: false, error: "You have already reported this post" },
        { status: 409 }
      )
    }

    // Create the report
    const report = await db.postReport.create({
      data: {
        post_id: postId,
        reporter_id: user.id,
        reason,
      },
    })

    return NextResponse.json({
      ok: true,
      report: {
        id: report.id,
        reason: report.reason,
        created_at: report.created_at.toISOString(),
      },
    }, { status: 201 })
  } catch (error) {
    console.error("Community report create error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to report post" },
      { status: 500 }
    )
  }
}
