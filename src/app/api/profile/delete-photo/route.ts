import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

// DELETE /api/profile/delete-photo — Delete one of the current user's photos
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { photoId } = body

    if (!photoId || typeof photoId !== "string") {
      return NextResponse.json({ ok: false, error: "photoId is required" }, { status: 400 })
    }

    // Find the photo and verify ownership
    const photo = await db.profilePhoto.findUnique({
      where: { id: photoId },
    })

    if (!photo) {
      return NextResponse.json({ ok: false, error: "Photo not found" }, { status: 404 })
    }

    if (photo.user_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Not your photo" }, { status: 403 })
    }

    // Delete the photo record
    await db.profilePhoto.delete({
      where: { id: photoId },
    })

    // Re-order remaining photos to fill the gap
    const remainingPhotos = await db.profilePhoto.findMany({
      where: { user_id: user.id },
      orderBy: { upload_order: "asc" },
    })

    for (let i = 0; i < remainingPhotos.length; i++) {
      if (remainingPhotos[i].upload_order !== i + 1) {
        await db.profilePhoto.update({
          where: { id: remainingPhotos[i].id },
          data: { upload_order: i + 1 },
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Delete photo error:", error)
    return NextResponse.json({ ok: false, error: "Failed to delete photo" }, { status: 500 })
  }
}
