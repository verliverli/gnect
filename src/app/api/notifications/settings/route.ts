import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/lib/constants'

// GET /api/notifications/settings — Get notification settings
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch notification_settings separately since getCurrentUser doesn't include it
    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      select: { notification_settings: true },
    })

    const settings = fullUser?.notification_settings
      ? JSON.parse(fullUser.notification_settings)
      : DEFAULT_NOTIFICATION_SETTINGS

    return NextResponse.json({ ok: true, data: settings })
  } catch (err) {
    console.error('Get notification settings error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PUT /api/notifications/settings — Update notification settings
export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const updates = await req.json()

    // Fetch current notification_settings
    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      select: { notification_settings: true },
    })

    const current = fullUser?.notification_settings
      ? JSON.parse(fullUser.notification_settings)
      : DEFAULT_NOTIFICATION_SETTINGS

    // Admin broadcasts can NEVER be disabled
    const merged = { ...current, ...updates }

    await db.user.update({
      where: { id: user.id },
      data: { notification_settings: JSON.stringify(merged) },
    })

    return NextResponse.json({ ok: true, data: merged })
  } catch (err) {
    console.error('Update notification settings error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
