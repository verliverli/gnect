import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/broadcasts/[broadcastId]/acknowledge — Acknowledge a broadcast
export async function POST(
  req: Request,
  { params }: { params: Promise<{ broadcastId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { broadcastId } = await params
    if (!broadcastId) {
      return NextResponse.json({ error: 'Missing broadcastId' }, { status: 400 })
    }

    await db.broadcastAck.upsert({
      where: {
        broadcast_id_user_id: {
          broadcast_id: broadcastId,
          user_id: user.id,
        },
      },
      create: {
        broadcast_id: broadcastId,
        user_id: user.id,
      },
      update: {},
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Acknowledge broadcast error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
