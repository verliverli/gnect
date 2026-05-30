import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/profile/update-status — Update quick status with duration
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { status_text, duration } = body

    // Validate
    if (status_text && status_text.length > 100) {
      return NextResponse.json({ error: 'Status too long (max 100 chars)' }, { status: 400 })
    }

    // Calculate expiry based on duration
    let expiresAt: Date | null = null
    if (status_text && duration) {
      const now = new Date()
      switch (duration) {
        case '1h':
          expiresAt = new Date(now.getTime() + 60 * 60 * 1000)
          break
        case '3h':
          expiresAt = new Date(now.getTime() + 3 * 60 * 60 * 1000)
          break
        case 'tonight': {
          // Until midnight Africa/Dar_es_Salaam (UTC+3)
          const midnight = new Date(now)
          midnight.setUTCHours(21, 0, 0, 0) // UTC 21:00 = TZ midnight
          if (midnight <= now) midnight.setDate(midnight.getDate() + 1)
          expiresAt = midnight
          break
        }
        case '12h':
          expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000)
          break
        case '24h':
        default:
          expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
          break
      }
    } else if (status_text) {
      // Default 24h
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    }

    // Deterministic gradient based on text
    const STATUS_GRADIENTS = [
      'linear-gradient(90deg, #059669, #10b981)',
      'linear-gradient(90deg, #7c3aed, #a78bfa)',
      'linear-gradient(90deg, #dc2626, #f87171)',
      'linear-gradient(90deg, #d97706, #fbbf24)',
      'linear-gradient(90deg, #0891b2, #22d3ee)',
      'linear-gradient(90deg, #be185d, #f472b6)',
      'linear-gradient(90deg, #4338ca, #818cf8)',
      'linear-gradient(90deg, #065f46, #34d399)',
    ]
    let gradient: string | null = null
    if (status_text) {
      let hash = 0
      for (let i = 0; i < status_text.length; i++) {
        hash = ((hash << 5) - hash + status_text.charCodeAt(i)) | 0
      }
      gradient = STATUS_GRADIENTS[Math.abs(hash) % STATUS_GRADIENTS.length]
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        status_text: status_text || null,
        status_gradient: gradient,
        status_expires_at: expiresAt,
        status_views: status_text ? 0 : user.status_views, // Reset views on new status
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Update status error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
