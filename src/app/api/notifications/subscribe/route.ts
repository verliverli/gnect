import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/notifications/subscribe — Register push subscription
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { endpoint, keys, deviceInfo } = await req.json()
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    await db.pushSubscription.upsert({
      where: {
        user_id_endpoint: {
          user_id: user.id,
          endpoint,
        },
      },
      create: {
        user_id: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        device_info: deviceInfo || null,
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        device_info: deviceInfo || null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Subscribe push error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE /api/notifications/subscribe — Remove push subscription
export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { endpoint } = await req.json()
    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
    }

    await db.pushSubscription.deleteMany({
      where: { user_id: user.id, endpoint },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Unsubscribe push error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
