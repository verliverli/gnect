import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"

// POST /api/chat/[chatId]/typing — Broadcast typing indicator
// The Socket.io service handles the real-time typing broadcast.
// This endpoint exists as a REST fallback / for non-Socket.io clients.
export async function POST(
  _request: NextRequest,
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

    // Socket.io service handles the real-time broadcast.
    // This endpoint just acknowledges the request.
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Typing indicator error:", error)
    return NextResponse.json({ ok: false, error: "Failed to broadcast typing" }, { status: 500 })
  }
}
