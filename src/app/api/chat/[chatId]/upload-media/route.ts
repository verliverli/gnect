import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { MEDIA_LIMITS, MEDIA_WORKER } from "@/lib/constants"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

// POST /api/chat/[chatId]/upload-media — Upload a photo for chat (via Telegram through Cloudflare Worker)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { chatId } = await params
    if (!chatId) {
      return NextResponse.json({ ok: false, error: "chatId is required" }, { status: 400 })
    }

    // Verify user is a participant of this chat
    const chat = await db.chat.findUnique({
      where: { id: chatId },
      select: { id: true, user1_id: true, user2_id: true },
    })

    if (!chat) {
      return NextResponse.json({ ok: false, error: "Chat not found" }, { status: 404 })
    }

    if (chat.user1_id !== user.id && chat.user2_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Not a participant of this chat" }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get("photo") as File | null

    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Only JPEG, PNG, and WebP images allowed" },
        { status: 400 }
      )
    }

    // Validate file size (2MB limit for chat photos)
    if (file.size > MEDIA_LIMITS.MAX_PHOTO_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Image must be under 2MB" },
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
        signal: AbortSignal.timeout(30000), // 30s timeout
      })

      if (!workerRes.ok) {
        const errText = await workerRes.text().catch(() => "Unknown error")
        console.error("Media worker upload error:", workerRes.status, errText)
        return NextResponse.json(
          { ok: false, error: "Image upload failed — storage service error" },
          { status: 500 }
        )
      }

      const workerData = await workerRes.json()
      if (!workerData.ok || !workerData.file_id) {
        console.error("Media worker unexpected response:", workerData)
        return NextResponse.json(
          { ok: false, error: "Image upload failed — invalid response" },
          { status: 500 }
        )
      }

      fileId = workerData.file_id
    } catch (uploadErr) {
      console.error("Media worker upload error:", uploadErr)
      return NextResponse.json(
        { ok: false, error: "Image upload timed out or failed — please try again" },
        { status: 504 }
      )
    }

    // Store as "tg:{file_id}" in database — our getMediaUrl() helper converts this
    // to the Cloudflare Worker display URL. This prefix distinguishes from old Catbox URLs.
    const mediaUrl = `tg:${fileId}`

    return NextResponse.json({ ok: true, data: { url: mediaUrl } })
  } catch (error) {
    console.error("Chat media upload error:", error)
    return NextResponse.json({ ok: false, error: "Failed to upload media" }, { status: 500 })
  }
}
