import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { MEDIA_LIMITS } from "@/lib/constants"

// PUT /api/chat/[chatId]/view-once?messageId=xxx — Mark a view-once photo as viewed
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { chatId } = await params
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get("messageId")

    if (!chatId || !messageId) {
      return NextResponse.json({ ok: false, error: "chatId and messageId are required" }, { status: 400 })
    }

    // Verify user is a participant of this chat
    const chat = await db.chat.findUnique({
      where: { id: chatId },
      select: { id: true, user1_id: true, user2_id: true },
    })

    if (!chat) {
      return NextResponse.json({ ok: false, error: "Chat not found" }, { status: 404 })
    }

    if (chat.user1_id !== user.id && chat.user2_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Not a participant of this chat" }, { status: 403 })
    }

    // Find the message
    const message = await db.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        chat_id: true,
        sender_id: true,
        is_view_once: true,
        viewed: true,
      },
    })

    if (!message) {
      return NextResponse.json({ ok: false, error: "Message not found" }, { status: 404 })
    }

    if (message.chat_id !== chatId) {
      return NextResponse.json({ ok: false, error: "Message not in this chat" }, { status: 400 })
    }

    // Must be a view-once message
    if (!message.is_view_once) {
      return NextResponse.json({ ok: false, error: "Not a view-once message" }, { status: 400 })
    }

    // Cannot mark own message as viewed (only the receiver can)
    if (message.sender_id === user.id) {
      return NextResponse.json({ ok: false, error: "Cannot view your own view-once message" }, { status: 400 })
    }

    // Already viewed
    if (message.viewed) {
      return NextResponse.json({ ok: true })
    }

    // Mark as viewed and update auto_delete_at to 24 hours from now
    const now = new Date()
    const openedDeleteAt = new Date(now.getTime() + MEDIA_LIMITS.OPENED_MEDIA_DELETE_HOURS * 60 * 60 * 1000)

    await db.message.update({
      where: { id: messageId },
      data: {
        viewed: true,
        viewed_at: now,
        auto_delete_at: openedDeleteAt,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("View-once error:", error)
    return NextResponse.json({ ok: false, error: "Failed to mark as viewed" }, { status: 500 })
  }
}
