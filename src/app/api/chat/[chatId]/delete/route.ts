import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// DELETE /api/chat/[chatId]/delete — Delete entire chat for BOTH users (hookup privacy default)
// This is the GNECT way: no trace, no history. Delete = gone for everyone.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { chatId } = await params
    if (!chatId) {
      return NextResponse.json({ ok: false, error: "chatId is required" }, { status: 400 })
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

    // Delete ALL messages in this chat first (due to foreign key constraint)
    await db.message.deleteMany({
      where: { chat_id: chatId },
    })

    // Delete the chat itself
    await db.chat.delete({
      where: { id: chatId },
    })

    return NextResponse.json({ ok: true, message: "Chat deleted for both users" })
  } catch (error) {
    console.error("Chat delete error:", error)
    return NextResponse.json({ ok: false, error: "Failed to delete chat" }, { status: 500 })
  }
}
