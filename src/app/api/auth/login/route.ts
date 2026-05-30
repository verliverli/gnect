import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyPassword, hashPassword, createSessionToken, setSessionCookie } from "@/lib/auth"
import { checkLoginRateLimit, recordLoginAttempt, clearLoginAttempts } from "@/lib/rate-limit"

// Read admin credentials from environment variables only (never hardcode)
const ADMIN_NICKNAME = process.env.ADMIN_NICKNAME || ""
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ""

// Constant-time string comparison to prevent timing attacks
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to avoid leaking length info via timing
    let result = 0
    for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i % b.length)
    return false
  }
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}

function isAdminCredentials(nickname: string, password: string): boolean {
  if (!ADMIN_NICKNAME || !ADMIN_PASSWORD) return false
  return constantTimeCompare(nickname, ADMIN_NICKNAME) && constantTimeCompare(password, ADMIN_PASSWORD)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nickname, password } = body

    if (!nickname || !password) {
      return NextResponse.json(
        { ok: false, error: "Nickname and password are required" },
        { status: 400 }
      )
    }

    // Login rate limiting (per nickname)
    if (!checkLoginRateLimit(nickname)) {
      return NextResponse.json(
        { ok: false, error: "Too many login attempts. Try again in 15 minutes." },
        { status: 429 }
      )
    }

    // Check if this is an admin login attempt (by admin nickname specifically)
    const isAdminAttempt = nickname === ADMIN_NICKNAME

    // Find user by nickname
    let user = await db.user.findUnique({ where: { nickname } })

    // If admin credentials and admin doesn't exist yet — auto-create
    if (!user && isAdminAttempt && isAdminCredentials(nickname, password)) {
      const password_hash = await hashPassword(ADMIN_PASSWORD)
      user = await db.user.create({
        data: {
          nickname: ADMIN_NICKNAME,
          password_hash,
          age: 0,           // Admin has no profile — age 0 signals "no age"
          region: "",        // Admin has no region
          role: "",          // Admin has no role per worklog
          is_admin: true,
          is_early_adopter: true,
          is_premium_free: true,
        },
      })

      // Initialize AppSettings if not exists
      const settings = await db.appSettings.findUnique({ where: { id: "app_settings" } })
      if (!settings) {
        await db.appSettings.create({ data: { id: "app_settings", is_premium_free: true } })
      }
    }

    if (!user) {
      recordLoginAttempt(nickname)
      return NextResponse.json(
        { ok: false, error: "Invalid nickname or password" },
        { status: 401 }
      )
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash)

    // For existing admin user: if normal password fails, check admin credentials
    // This ensures admin can always log in even if password was somehow changed
    if (!valid && user.is_admin && isAdminCredentials(nickname, password)) {
      // Admin credentials work — also update the password hash to stay in sync
      const newHash = await hashPassword(ADMIN_PASSWORD)
      await db.user.update({ where: { id: user.id }, data: { password_hash: newHash } })
    } else if (!valid) {
      recordLoginAttempt(nickname)
      return NextResponse.json(
        { ok: false, error: "Invalid nickname or password" },
        { status: 401 }
      )
    }

    // Check if user is banned
    if (user.is_banned) {
      return NextResponse.json(
        { ok: false, error: "This account has been suspended" },
        { status: 403 }
      )
    }

    // Ensure admin user has is_admin flag
    if (user.is_admin === false && isAdminCredentials(nickname, password)) {
      user = await db.user.update({
        where: { id: user.id },
        data: { is_admin: true },
      })
    }

    // Clear login attempts on successful login
    clearLoginAttempts(nickname)

    // Create session
    const token = await createSessionToken(user.id)
    await setSessionCookie(token)

    // Update last_seen and online status
    await db.user.update({
      where: { id: user.id },
      data: { last_seen: new Date(), is_online: true },
    })

    // Return user without password_hash
    const { password_hash: _ph, ...safeUser } = user
    return NextResponse.json({ ok: true, user: safeUser })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ ok: false, error: "Login failed" }, { status: 500 })
  }
}
