// ============================================
// GNECT Community — Add Comment
// POST /api/community/posts/[postId]/comments — Add a comment to a post
// ============================================

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { containsLink } from "@/lib/constants"

const MAX_COMMENT_LENGTH = 500
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    // Admin cannot comment on community posts
    if (user.is_admin) {
      return NextResponse.json(
        { ok: false, error: "Admins cannot comment on community posts" },
        { status: 403 }
      )
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
    const { content } = body

    // Validate content (1–500 chars)
    if (!content || typeof content !== "string" || content.trim().length < 1) {
      return NextResponse.json(
        { ok: false, error: "Comment content is required" },
        { status: 400 }
      )
    }
    if (content.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json(
        { ok: false, error: `Comment must be ${MAX_COMMENT_LENGTH} characters or less` },
        { status: 400 }
      )
    }

    // Block links (phishing, spam, doxxing)
    if (containsLink(content)) {
      return NextResponse.json(
        { ok: false, error: "Links are not allowed in comments" },
        { status: 400 }
      )
    }

    // Set auto_delete_at = 7 days from now (same as post TTL)
    const autoDeleteAt = new Date(Date.now() + SEVEN_DAYS_MS)

    // Create comment and increment post's comment count in a transaction
    const comment = await db.$transaction(async (tx) => {
      const newComment = await tx.postComment.create({
        data: {
          post_id: postId,
          user_id: user.id,
          content: content.trim(),
          auto_delete_at: autoDeleteAt,
        },
      })

      await tx.communityPost.update({
        where: { id: postId },
        data: { comments_count: { increment: 1 } },
      })

      return newComment
    })

    // Return comment (no user_id exposed — anonymity)
    return NextResponse.json({
      ok: true,
      comment: {
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at.toISOString(),
        is_own: true,
      },
    }, { status: 201 })
  } catch (error) {
    console.error("Community comment create error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to add comment" },
      { status: 500 }
    )
  }
}
