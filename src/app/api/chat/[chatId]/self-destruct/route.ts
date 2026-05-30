import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// PUT /api/chat/[chatId]/self-destruct — Set self-destruct timer for all messages in chat
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

    const { chatId } = await params
    const body = await request.json()
    const hours = typeof body.hours === 'number' ? body.hours : 0

    if (hours < 0 || hours > 168) {
      return NextResponse.json({ ok: false, error: 'Hours must be 0-168' }, { status: 400 })
    }

    // Verify the user is part of this chat
    const chat = await db.chat.findUnique({
      where: { id: chatId },
      select: { id: true, user1_id: true, user2_id: true },
    })

    if (!chat || (chat.user1_id !== user.id && chat.user2_id !== user.id)) {
      return NextResponse.json({ ok: false, error: 'Chat not found' }, { status: 404 })
    }

    if (hours === 0) {
      // Remove self-destruct — restore hard_delete_at to 7-day default for all messages
      const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      await db.message.updateMany({
        where: { chat_id: chatId },
        data: { hard_delete_at: sevenDays },
      })
    } else {
      // Set hard_delete_at for all messages in this chat to the self-destruct time
      // This overrides the default 7-day limit with the user-chosen timer
      const deleteAt = new Date(Date.now() + hours * 60 * 60 * 1000)
      await db.message.updateMany({
        where: { chat_id: chatId },
        data: { hard_delete_at: deleteAt },
      })
    }

    return NextResponse.json({ ok: true, data: { hours } })
  } catch (err) {
    console.error('Self-destruct error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
