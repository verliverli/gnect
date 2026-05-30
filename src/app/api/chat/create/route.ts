import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// POST /api/chat/create — Create or get existing chat between two users
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { userId } = body

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ ok: false, error: "userId is required" }, { status: 400 })
    }

    // Cannot chat with yourself
    if (userId === user.id) {
      return NextResponse.json({ ok: false, error: "Cannot chat with yourself" }, { status: 400 })
    }

    // Check if target user exists
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, is_admin: true, is_banned: true },
    })

    if (!targetUser) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 })
    }

    if (targetUser.is_banned) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 })
    }

    // Cannot chat with admin
    if (targetUser.is_admin) {
      return NextResponse.json({ ok: false, error: "Cannot chat with admin" }, { status: 403 })
    }

    // Check block status (both directions)
    const blockRecord = await db.block.findFirst({
      where: {
        OR: [
          { blocker_id: user.id, blocked_id: userId },
          { blocker_id: userId, blocked_id: user.id },
        ],
      },
    })

    if (blockRecord) {
      return NextResponse.json({ ok: false, error: "Cannot chat with blocked user" }, { status: 403 })
    }

    // Check if chat already exists — unique constraint is on [user1_id, user2_id]
    // We need to check both orderings since either user could be user1 or user2
    const existingChat = await db.chat.findFirst({
      where: {
        OR: [
          { user1_id: user.id, user2_id: userId },
          { user1_id: userId, user2_id: user.id },
        ],
      },
    })

    if (existingChat) {
      return NextResponse.json({
        ok: true,
        data: {
          id: existingChat.id,
          user1_id: existingChat.user1_id,
          user2_id: existingChat.user2_id,
          created_at: existingChat.created_at,
        },
      })
    }

    // Create new chat — always put smaller ID as user1 for consistency with unique constraint
    const [sortedId1, sortedId2] = user.id < userId ? [user.id, userId] : [userId, user.id]

    const chat = await db.chat.create({
      data: {
        user1_id: sortedId1,
        user2_id: sortedId2,
      },
    })

    return NextResponse.json({
      ok: true,
      data: {
        id: chat.id,
        user1_id: chat.user1_id,
        user2_id: chat.user2_id,
        created_at: chat.created_at,
      },
    })
  } catch (error) {
    console.error("Chat create error:", error)
    return NextResponse.json({ ok: false, error: "Failed to create chat" }, { status: 500 })
  }
}
