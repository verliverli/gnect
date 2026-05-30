// ============================================
// GNECT Community — Toggle Upvote
// POST /api/community/posts/[postId]/upvote — Toggle upvote on a post
// ============================================

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

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
      select: {
        id: true,
        upvotes_count: true,
        is_deleted: true,
        auto_delete_at: true,
      },
    })

    if (!post || post.is_deleted || post.auto_delete_at < new Date()) {
      return NextResponse.json(
        { ok: false, error: "Post not found" },
        { status: 404 }
      )
    }

    // Check if user already upvoted this post
    const existingUpvote = await db.postUpvote.findUnique({
      where: {
        post_id_user_id: {
          post_id: postId,
          user_id: user.id,
        },
      },
    })

    if (existingUpvote) {
      // TOGGLE OFF — remove upvote, decrement count
      await db.$transaction([
        db.postUpvote.delete({
          where: { id: existingUpvote.id },
        }),
        db.communityPost.update({
          where: { id: postId },
          data: { upvotes_count: { decrement: 1 } },
        }),
      ])

      return NextResponse.json({
        ok: true,
        upvoted: false,
        upvotes_count: post.upvotes_count - 1,
      })
    } else {
      // TOGGLE ON — create upvote, increment count
      await db.$transaction([
        db.postUpvote.create({
          data: {
            post_id: postId,
            user_id: user.id,
          },
        }),
        db.communityPost.update({
          where: { id: postId },
          data: { upvotes_count: { increment: 1 } },
        }),
      ])

      return NextResponse.json({
        ok: true,
        upvoted: true,
        upvotes_count: post.upvotes_count + 1,
      })
    }
  } catch (error) {
    console.error("Community upvote toggle error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to toggle upvote" },
      { status: 500 }
    )
  }
}
