import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { BODY_TYPES, AVAILABILITY_STATUSES } from "@/lib/constants"

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    // Validate and build updates object — only include provided fields
    if (body.bio !== undefined) {
      if (typeof body.bio !== "string" || body.bio.length > 300) {
        return NextResponse.json({ ok: false, error: "Bio must be 300 characters or less" }, { status: 400 })
      }
      updates.bio = body.bio
    }

    if (body.height !== undefined) {
      if (typeof body.height !== "number" || !Number.isInteger(body.height) || body.height < 100 || body.height > 250) {
        return NextResponse.json({ ok: false, error: "Height must be 100-250 cm" }, { status: 400 })
      }
      updates.height = body.height
    }

    if (body.weight !== undefined) {
      if (typeof body.weight !== "number" || !Number.isInteger(body.weight) || body.weight < 30 || body.weight > 300) {
        return NextResponse.json({ ok: false, error: "Weight must be 30-300 kg" }, { status: 400 })
      }
      updates.weight = body.weight
    }

    if (body.body_type !== undefined) {
      if (!BODY_TYPES.includes(body.body_type)) {
        return NextResponse.json({ ok: false, error: "Invalid body type" }, { status: 400 })
      }
      updates.body_type = body.body_type
    }

    if (body.availability !== undefined) {
      if (!AVAILABILITY_STATUSES.includes(body.availability)) {
        return NextResponse.json({ ok: false, error: "Invalid availability status" }, { status: 400 })
      }
      updates.availability = body.availability
    }

    if (body.discretion_mode !== undefined) {
      if (typeof body.discretion_mode !== "boolean") {
        return NextResponse.json({ ok: false, error: "discretion_mode must be boolean" }, { status: 400 })
      }
      updates.discretion_mode = body.discretion_mode
    }

    if (body.secret_phrase !== undefined) {
      if (typeof body.secret_phrase !== "string" || body.secret_phrase.length > 50) {
        return NextResponse.json({ ok: false, error: "Secret phrase must be 50 characters or less" }, { status: 400 })
      }
      updates.secret_phrase = body.secret_phrase || null
    }

    if (body.street !== undefined) {
      if (typeof body.street !== "string" || body.street.length > 30) {
        return NextResponse.json({ ok: false, error: "Street must be 30 characters or less" }, { status: 400 })
      }
      updates.street = body.street || null
    }

    if (body.cucumber_size !== undefined) {
      if (typeof body.cucumber_size !== "number" || !Number.isInteger(body.cucumber_size) || body.cucumber_size < 1 || body.cucumber_size > 15) {
        return NextResponse.json({ ok: false, error: "Cucumber size must be 1-15 inches" }, { status: 400 })
      }
      updates.cucumber_size = body.cucumber_size
    }

    if (body.show_cucumber !== undefined) {
      if (typeof body.show_cucumber !== "boolean") {
        return NextResponse.json({ ok: false, error: "show_cucumber must be boolean" }, { status: 400 })
      }
      updates.show_cucumber = body.show_cucumber
    }

    if (body.status_text !== undefined) {
      if (body.status_text !== null && (typeof body.status_text !== "string" || body.status_text.length > 40)) {
        return NextResponse.json({ ok: false, error: "Status text must be 40 characters or less" }, { status: 400 })
      }
      updates.status_text = body.status_text || null
    }

    if (body.status_gradient !== undefined) {
      if (body.status_gradient !== null && (typeof body.status_gradient !== "string" || body.status_gradient.length > 100)) {
        return NextResponse.json({ ok: false, error: "Invalid status gradient" }, { status: 400 })
      }
      updates.status_gradient = body.status_gradient || null
    }

    // Nothing to update
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: "No valid fields to update" }, { status: 400 })
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: updates,
      select: {
        id: true, nickname: true, age: true, region: true, bio: true,
        height: true, weight: true, body_type: true, role: true,
        role_last_changed: true, availability: true, discretion_mode: true,
        secret_phrase: true, not_today: true, not_today_expires: true,
        street: true, cucumber_size: true, show_cucumber: true,
        status_text: true, status_gradient: true,
        is_premium: true, is_premium_free: true, is_early_adopter: true,
        is_admin: true, is_online: true, last_seen: true, created_at: true, updated_at: true,
      },
    })

    return NextResponse.json({ ok: true, data: updated })
  } catch (error) {
    console.error("Profile update error:", error)
    return NextResponse.json({ ok: false, error: "Failed to update profile" }, { status: 500 })
  }
}
