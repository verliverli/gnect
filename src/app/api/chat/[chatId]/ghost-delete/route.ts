import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// PUT /api/chat/[chatId]/ghost-delete?messageId=xxx — Ghost delete a message (deleted for you only, other person still sees it)
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
        is_ghost_deleted: true,
      },
    })

    if (!message) {
      return NextResponse.json({ ok: false, error: "Message not found" }, { status: 404 })
    }

    if (message.chat_id !== chatId) {
      return NextResponse.json({ ok: false, error: "Message not in this chat" }, { status: 400 })
    }

    // Already ghost-deleted
    if (message.is_ghost_deleted) {
      return NextResponse.json({ ok: true })
    }

    // Mark as ghost-deleted (hidden for the deleter only)
    await db.message.update({
      where: { id: messageId },
      data: {
        is_ghost_deleted: true,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Ghost delete error:", error)
    return NextResponse.json({ ok: false, error: "Failed to ghost delete message" }, { status: 500 })
  }
}
