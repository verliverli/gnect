import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { INTO_TAGS, MEDIA_LIMITS } from "@/lib/constants"

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { tags } = body

    // Validate tags array
    if (!Array.isArray(tags)) {
      return NextResponse.json({ ok: false, error: "Tags must be an array" }, { status: 400 })
    }

    if (tags.length > MEDIA_LIMITS.MAX_INTO_TAGS) {
      return NextResponse.json({ ok: false, error: `Maximum ${MEDIA_LIMITS.MAX_INTO_TAGS} tags allowed` }, { status: 400 })
    }

    // Validate each tag is in the preset list
    const validTags = INTO_TAGS as readonly string[]
    for (const tag of tags) {
      if (typeof tag !== "string" || !validTags.includes(tag)) {
        return NextResponse.json({ ok: false, error: `Invalid tag: ${tag}` }, { status: 400 })
      }
    }

    // Check for duplicates
    if (new Set(tags).size !== tags.length) {
      return NextResponse.json({ ok: false, error: "Duplicate tags not allowed" }, { status: 400 })
    }

    // Replace strategy: delete all existing, create new ones
    await db.intoTag.deleteMany({ where: { user_id: user.id } })

    if (tags.length > 0) {
      await db.intoTag.createMany({
        data: tags.map((tag: string) => ({ user_id: user.id, tag })),
      })
    }

    const updatedTags = await db.intoTag.findMany({
      where: { user_id: user.id },
      select: { id: true, tag: true },
    })

    return NextResponse.json({ ok: true, data: updatedTags })
  } catch (error) {
    console.error("Update tags error:", error)
    return NextResponse.json({ ok: false, error: "Failed to update tags" }, { status: 500 })
  }
}
