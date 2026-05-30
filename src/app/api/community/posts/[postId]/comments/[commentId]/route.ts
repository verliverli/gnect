// ============================================
// GNECT Community — Delete Comment
// DELETE /api/community/posts/[postId]/comments/[commentId] — Soft-delete own comment
// ============================================

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string; commentId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { postId, commentId } = await params

    // Fetch the comment
    const comment = await db.postComment.findUnique({
      where: { id: commentId },
      select: { id: true, post_id: true, user_id: true, is_deleted: true },
    })

    if (!comment) {
      return NextResponse.json(
        { ok: false, error: "Comment not found" },
        { status: 404 }
      )
    }

    // Ensure the comment belongs to the specified post
    if (comment.post_id !== postId) {
      return NextResponse.json(
        { ok: false, error: "Comment does not belong to this post" },
        { status: 400 }
      )
    }

    // Only the author can delete their own comment
    if (comment.user_id !== user.id) {
      return NextResponse.json(
        { ok: false, error: "You can only delete your own comments" },
        { status: 403 }
      )
    }

    // Already deleted
    if (comment.is_deleted) {
      return NextResponse.json(
        { ok: false, error: "Comment already deleted" },
        { status: 400 }
      )
    }

    // Soft delete comment and decrement post's comment count in a transaction
    await db.$transaction([
      db.postComment.update({
        where: { id: commentId },
        data: { is_deleted: true },
      }),
      db.communityPost.update({
        where: { id: postId },
        data: { comments_count: { decrement: 1 } },
      }),
    ])

    return NextResponse.json({ ok: true, message: "Comment deleted" })
  } catch (error) {
    console.error("Community comment delete error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to delete comment" },
      { status: 500 }
    )
  }
}
