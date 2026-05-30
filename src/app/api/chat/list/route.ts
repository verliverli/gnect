import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// GET /api/chat/list — Get all chats for the current user
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get("cursor")
    const limit = 20

    // Fetch chats where current user is a participant
    const where = {
      OR: [{ user1_id: user.id }, { user2_id: user.id }],
      ...(cursor ? { id: { lt: cursor } } : {}),
    }

    const chats = await db.chat.findMany({
      where,
      orderBy: { last_message_at: "desc" },
      take: limit + 1,
      select: {
        id: true,
        user1_id: true,
        user2_id: true,
        last_message_at: true,
        created_at: true,
        messages: {
          take: 1,
          orderBy: { sent_at: "desc" },
          where: { is_unsent: false },
          select: {
            id: true,
            content: true,
            media_url: true,
            media_type: true,
            sender_id: true,
            sent_at: true,
            is_view_once: true,
            viewed: true,
            is_ghost_deleted: true,
          },
        },
      },
    })

    const hasNextPage = chats.length > limit
    if (hasNextPage) chats.length = limit
    const nextCursor = hasNextPage ? chats[chats.length - 1].id : null

    // Get other user IDs for batch fetching
    const otherUserIds = chats.map((chat) =>
      chat.user1_id === user.id ? chat.user2_id : chat.user1_id
    )

    // Batch fetch other users' info
    const otherUsers = await db.user.findMany({
      where: { id: { in: otherUserIds } },
      select: {
        id: true,
        nickname: true,
        is_online: true,
        photos: {
          where: { is_face_pic: true, is_locked: false },
          select: { catbox_url: true },
          orderBy: { upload_order: "asc" },
          take: 1,
        },
      },
    })

    const otherUserMap = new Map(otherUsers.map((u) => [u.id, u]))

    // Count unread messages per chat (messages where sender is NOT the current user and not viewed)
    const chatIds = chats.map((c) => c.id)
    const unreadCounts = await db.message.groupBy({
      by: ["chat_id"],
      where: {
        chat_id: { in: chatIds },
        sender_id: { not: user.id },
        viewed: false,
        is_unsent: false,
        is_ghost_deleted: false,
      },
      _count: { id: true },
    })

    const unreadMap = new Map(unreadCounts.map((u) => [u.chat_id, u._count.id]))

    // Format response
    const data = chats.map((chat) => {
      const otherUserId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id
      const otherUser = otherUserMap.get(otherUserId)
      const lastMessage = chat.messages[0]

      // Filter out ghost-deleted messages for current user (they deleted their own view)
      const visibleLastMessage =
        lastMessage && !(lastMessage.is_ghost_deleted && lastMessage.sender_id === user.id)
          ? {
              content: lastMessage.content,
              sent_at: lastMessage.sent_at,
              sender_id: lastMessage.sender_id,
              media_type: lastMessage.media_type,
              is_view_once: lastMessage.is_view_once,
            }
          : null

      return {
        id: chat.id,
        otherUser: otherUser
          ? {
              id: otherUser.id,
              nickname: otherUser.nickname,
              photo: otherUser.photos[0]?.catbox_url ?? null,
              is_online: otherUser.is_online,
            }
          : { id: otherUserId, nickname: "Unknown", photo: null, is_online: false },
        lastMessage: visibleLastMessage,
        unreadCount: unreadMap.get(chat.id) ?? 0,
        last_message_at: chat.last_message_at,
      }
    })

    return NextResponse.json({ ok: true, data, nextCursor })
  } catch (error) {
    console.error("Chat list error:", error)
    return NextResponse.json({ ok: false, error: "Failed to get chats" }, { status: 500 })
  }
}
