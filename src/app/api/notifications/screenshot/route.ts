import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createNotification } from '@/lib/notifications'

// POST /api/notifications/screenshot — Screenshot detected
export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Create a notification for the user that a screenshot was detected
    await createNotification({
      userId: user.id,
      type: 'screenshot',
      title: '📸 Screenshot detected',
      body: 'A screenshot was captured. Be careful sharing sensitive content.',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Screenshot notification error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
