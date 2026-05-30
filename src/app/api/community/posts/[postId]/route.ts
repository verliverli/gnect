// ============================================
// GNECT Community — Single Post Detail & Delete
// GET    /api/community/posts/[postId] — Get post + comments
// DELETE /api/community/posts/[postId] — Soft-delete own post
// ============================================

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// -------------------------------------------
// GET /api/community/posts/[postId] — Single post with comments
// -------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { postId } = await params

    // Fetch the post
    const post = await db.communityPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        content: true,
        category: true,
        region_tag: true,
        upvotes_count: true,
        comments_count: true,
        auto_delete_at: true,
        created_at: true,
        is_deleted: true,
        user_id: true, // kept for is_own, stripped from response
        upvotes: {
          where: { user_id: user.id },
          select: { id: true },
        },
        comments: {
          where: {
            is_deleted: false,
            auto_delete_at: { gte: new Date() },
          },
          orderBy: { created_at: "asc" },
          select: {
            id: true,
            content: true,
            created_at: true,
            user_id: true, // kept for is_own, stripped from response
          },
        },
      },
    })

    // Not found, deleted, or auto-expired
    if (!post || post.is_deleted || post.auto_delete_at < new Date()) {
      return NextResponse.json(
        { ok: false, error: "Post not found" },
        { status: 404 }
      )
    }

    // Format post — strip user_id for anonymity
    const postData = {
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
      comments: post.comments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at.toISOString(),
        is_own: comment.user_id === user.id,
      })),
    }

    return NextResponse.json({ ok: true, post: postData })
  } catch (error) {
    console.error("Community post detail error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to fetch post" },
      { status: 500 }
    )
  }
}

// -------------------------------------------
// DELETE /api/community/posts/[postId] — Soft-delete own post
// -------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { postId } = await params

    // Fetch the post
    const post = await db.communityPost.findUnique({
      where: { id: postId },
      select: { id: true, user_id: true, is_deleted: true },
    })

    if (!post) {
      return NextResponse.json(
        { ok: false, error: "Post not found" },
        { status: 404 }
      )
    }

    // Only the author can delete their own post
    if (post.user_id !== user.id) {
      return NextResponse.json(
        { ok: false, error: "You can only delete your own posts" },
        { status: 403 }
      )
    }

    // Already deleted
    if (post.is_deleted) {
      return NextResponse.json(
        { ok: false, error: "Post already deleted" },
        { status: 400 }
      )
    }

    // Soft delete — set is_deleted = true
    await db.communityPost.update({
      where: { id: postId },
      data: { is_deleted: true },
    })

    return NextResponse.json({ ok: true, message: "Post deleted" })
  } catch (error) {
    console.error("Community post delete error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to delete post" },
      { status: 500 }
    )
  }
}
