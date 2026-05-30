import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// POST — Block a user
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId is required" }, { status: 400 })
    }

    // Cannot block yourself
    if (userId === user.id) {
      return NextResponse.json({ ok: false, error: "Cannot block yourself" }, { status: 400 })
    }

    // Check if target user exists
    const targetUser = await db.user.findUnique({ where: { id: userId } })
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 })
    }

    // Cannot block admin
    if (targetUser.is_admin) {
      return NextResponse.json({ ok: false, error: "Cannot block an admin" }, { status: 403 })
    }

    // Check if already blocked
    const existing = await db.block.findUnique({
      where: {
        blocker_id_blocked_id: {
          blocker_id: user.id,
          blocked_id: userId,
        },
      },
    })

    if (existing) {
      return NextResponse.json({ ok: false, error: "User already blocked" }, { status: 409 })
    }

    await db.block.create({
      data: {
        blocker_id: user.id,
        blocked_id: userId,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Block user error:", error)
    return NextResponse.json({ ok: false, error: "Failed to block user" }, { status: 500 })
  }
}

// DELETE — Unblock a user
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId is required" }, { status: 400 })
    }

    const existing = await db.block.findUnique({
      where: {
        blocker_id_blocked_id: {
          blocker_id: user.id,
          blocked_id: userId,
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Block not found" }, { status: 404 })
    }

    await db.block.delete({
      where: {
        blocker_id_blocked_id: {
          blocker_id: user.id,
          blocked_id: userId,
        },
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Unblock user error:", error)
    return NextResponse.json({ ok: false, error: "Failed to unblock user" }, { status: 500 })
  }
}

// GET — List all blocked users for the authenticated user
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const blocks = await db.block.findMany({
      where: { blocker_id: user.id },
      include: {
        blocked: {
          select: {
            id: true,
            nickname: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    })

    const data = blocks.map((b) => b.blocked)

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error("Get blocked users error:", error)
    return NextResponse.json({ ok: false, error: "Failed to get blocked users" }, { status: 500 })
  }
}
