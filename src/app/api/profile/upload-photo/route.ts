import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser, hasPremiumAccess } from "@/lib/auth"
import { MEDIA_LIMITS, MEDIA_WORKER } from "@/lib/constants"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("photo") as File | null
    const isFacePic = formData.get("is_face_pic") === "true"
    const isLocked = formData.get("is_locked") === "true"

    // Validate file exists
    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ ok: false, error: "Only JPEG, PNG, and WebP images allowed" }, { status: 400 })
    }

    // Validate file size
    if (file.size > MEDIA_LIMITS.MAX_PHOTO_SIZE_BYTES) {
      return NextResponse.json({ ok: false, error: "Image must be under 2MB" }, { status: 400 })
    }

    // Check photo count limit
    const photoCount = await db.profilePhoto.count({ where: { user_id: user.id } })
    const isPremium = hasPremiumAccess(user)
    const maxPhotos = isPremium
      ? MEDIA_LIMITS.MAX_PREMIUM_PROFILE_PHOTOS
      : MEDIA_LIMITS.MAX_FREE_PROFILE_PHOTOS

    if (photoCount >= maxPhotos) {
      return NextResponse.json(
        { ok: false, error: `Photo limit reached (${maxPhotos} for ${isPremium ? "premium" : "free"} users)` },
        { status: 400 }
      )
    }

    // Upload to Telegram via Cloudflare Worker proxy
    const workerForm = new FormData()
    workerForm.append("file", file)

    let fileId: string
    try {
      const workerRes = await fetch(`${MEDIA_WORKER.URL}${MEDIA_WORKER.ENDPOINTS.UPLOAD}`, {
        method: "POST",
        body: workerForm,
        signal: AbortSignal.timeout(30000),
      })

      if (!workerRes.ok) {
        const errText = await workerRes.text().catch(() => "Unknown error")
        console.error("Media worker upload error:", workerRes.status, errText)
        return NextResponse.json({ ok: false, error: "Image upload failed — storage service error" }, { status: 500 })
      }

      const workerData = await workerRes.json()
      if (!workerData.ok || !workerData.file_id) {
        console.error("Media worker unexpected response:", workerData)
        return NextResponse.json({ ok: false, error: "Image upload failed — invalid response" }, { status: 500 })
      }

      fileId = workerData.file_id
    } catch (uploadErr) {
      console.error("Media worker upload error:", uploadErr)
      return NextResponse.json(
        { ok: false, error: "Image upload timed out or failed — please try again" },
        { status: 504 }
      )
    }

    // Store as "tg:{file_id}" — getMediaUrl() converts to display URL
    const mediaUrl = `tg:${fileId}`

    // Create photo record in database
    const photo = await db.profilePhoto.create({
      data: {
        user_id: user.id,
        catbox_url: mediaUrl, // Reusing existing field for Telegram file_id (with tg: prefix)
        is_face_pic: isFacePic,
        is_locked: isLocked,
        upload_order: photoCount + 1,
      },
    })

    return NextResponse.json({ ok: true, data: photo })
  } catch (error) {
    console.error("Photo upload error:", error)
    return NextResponse.json({ ok: false, error: "Failed to upload photo" }, { status: 500 })
  }
}
