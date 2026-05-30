import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword, createSessionToken, setSessionCookie } from "@/lib/auth"
import { validateNickname, isBotNickname, validatePassword, validateAge } from "@/lib/validation"
import { validateRegion, validateRole } from "@/lib/validation"
import { RATE_LIMITS } from "@/lib/constants"
import { checkIPRegistrationLimit, recordIPRegistration } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nickname, password, age, region, role, street, cucumber_size, show_cucumber, website, startTime } = body

    // Honeypot check — silently reject bots
    if (website) {
      return NextResponse.json({ ok: true, user: null })
    }

    // Timing check — reject if submitted under 2 seconds
    if (startTime && typeof startTime === "number") {
      const elapsed = Date.now() - startTime
      if (elapsed < RATE_LIMITS.MIN_REGISTER_TIME_MS) {
        return NextResponse.json({ ok: true, user: null })
      }
    }

    // Validate nickname (unified validation)
    if (!nickname || typeof nickname !== "string") {
      return NextResponse.json({ ok: false, error: "Nickname is required" }, { status: 400 })
    }
    const nickValidation = validateNickname(nickname)
    if (!nickValidation.valid) {
      return NextResponse.json({ ok: false, error: nickValidation.error }, { status: 400 })
    }
    if (isBotNickname(nickname)) {
      return NextResponse.json({ ok: false, error: "Nickname not allowed" }, { status: 400 })
    }

    // Validate password
    const passValidation = validatePassword(password)
    if (!passValidation.valid) {
      return NextResponse.json({ ok: false, error: passValidation.error }, { status: 400 })
    }

    // Validate age
    if (!age || typeof age !== "number") {
      return NextResponse.json({ ok: false, error: "Age is required" }, { status: 400 })
    }
    const ageValidation = validateAge(age)
    if (!ageValidation.valid) {
      return NextResponse.json({ ok: false, error: ageValidation.error }, { status: 400 })
    }

    // Validate region
    if (!region || !validateRegion(region)) {
      return NextResponse.json({ ok: false, error: "Invalid region" }, { status: 400 })
    }

    // Validate role
    if (!role || !validateRole(role)) {
      return NextResponse.json({ ok: false, error: "Invalid role" }, { status: 400 })
    }

    // IP rate limit — extract first IP from x-forwarded-for
    const rawIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
    const ip = rawIp.split(",")[0].trim()
    const ipAllowed = await checkIPRegistrationLimit(ip)
    if (!ipAllowed) {
      return NextResponse.json({ ok: false, error: "Too many registrations from this device" }, { status: 429 })
    }

    // Nickname uniqueness
    const existing = await db.user.findUnique({ where: { nickname } })
    if (existing) {
      return NextResponse.json({ ok: false, error: "Nickname already taken" }, { status: 409 })
    }

    // Validate optional fields
    let safeStreet: string | undefined
    if (street && typeof street === "string") {
      safeStreet = street.trim().slice(0, 30) || undefined
    }

    let safeCucumberSize: number | undefined
    if (cucumber_size && typeof cucumber_size === "number") {
      if (cucumber_size >= 1 && cucumber_size <= 15) {
        safeCucumberSize = cucumber_size
      }
    }

    const safeShowCucumber = typeof show_cucumber === "boolean" ? show_cucumber : false

    // Hash password and create user (NO admin check on register — admin is login-only)
    const password_hash = await hashPassword(password)
    const user = await db.user.create({
      data: {
        nickname,
        password_hash,
        age,
        region,
        role,
        ...(safeStreet ? { street: safeStreet } : {}),
        ...(safeCucumberSize ? { cucumber_size: safeCucumberSize } : {}),
        show_cucumber: safeShowCucumber,
      },
    })

    // Record IP registration
    await recordIPRegistration(ip)

    // Initialize AppSettings if not exists
    const settings = await db.appSettings.findUnique({ where: { id: "app_settings" } })
    if (!settings) {
      await db.appSettings.create({ data: { id: "app_settings", is_premium_free: true } })
    }

    // Check early adopter status (atomic increment to avoid race condition)
    const isEarlyAdopter = await db.appSettings.update({
      where: { id: "app_settings" },
      data: { early_adopter_count: { increment: 1 } },
      select: { early_adopter_count: true, max_early_adopters: true },
    })

    if (isEarlyAdopter.early_adopter_count <= isEarlyAdopter.max_early_adopters) {
      await db.user.update({ where: { id: user.id }, data: { is_early_adopter: true } })
    }

    // Create session
    const token = await createSessionToken(user.id)
    await setSessionCookie(token)

    // Return user without password_hash
    const { password_hash: _ph, ...safeUser } = user
    return NextResponse.json({
      ok: true,
      user: safeUser,
    })
  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json({ ok: false, error: "Registration failed" }, { status: 500 })
  }
}
