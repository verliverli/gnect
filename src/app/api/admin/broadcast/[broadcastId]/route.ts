import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// DELETE /api/admin/broadcast/[broadcastId] — Delete a broadcast (admin only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ broadcastId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!user.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

    const { broadcastId } = await params
    if (!broadcastId) {
      return NextResponse.json({ error: 'Missing broadcastId' }, { status: 400 })
    }

    // Delete associated notifications too
    await db.notification.deleteMany({
      where: { type: 'admin_broadcast', data: { contains: broadcastId } },
    })

    await db.adminBroadcast.delete({ where: { id: broadcastId } })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Delete broadcast error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
