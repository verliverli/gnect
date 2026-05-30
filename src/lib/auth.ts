// ============================================
// GNECT AUTH UTILITIES
// JWT-based session management with jose
// ============================================

import bcrypt from "bcryptjs"
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { db } from "./db"

const SALT_ROUNDS = 10
const SESSION_COOKIE_NAME = "gnect_session"
const SESSION_DURATION = "7d"

// Get JWT secret key
function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set. This is required for security.")
  }
  return new TextEncoder().encode(secret)
}

// Hash a password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

// Verify a password against a hash
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Create a JWT session token
export async function createSessionToken(userId: string): Promise<string> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecretKey())
  return token
}

// Verify a JWT session token
export async function verifySessionToken(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    return { userId: payload.userId as string }
  } catch {
    return null
  }
}

// Set session cookie
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  })
}

// Get session token from cookie
export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE_NAME)?.value
}

// Clear session cookie
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

// Get current user from session (returns null if not authenticated)
export async function getCurrentUser() {
  const token = await getSessionToken()
  if (!token) return null

  const payload = await verifySessionToken(token)
  if (!payload) return null

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      nickname: true,
      age: true,
      region: true,
      bio: true,
      height: true,
      weight: true,
      body_type: true,
      role: true,
      role_last_changed: true,
      availability: true,
      discretion_mode: true,
      secret_phrase: true,
      not_today: true,
      not_today_expires: true,
      is_premium: true,
      is_premium_free: true,
      is_early_adopter: true,
      is_admin: true,
      is_banned: true,
      is_online: true,
      last_seen: true,
      chats_this_week: true,
      chats_week_reset: true,
      not_today_count: true,
      not_today_reset: true,
      street: true,
      cucumber_size: true,
      show_cucumber: true,
      status_text: true,
      status_gradient: true,
      status_expires_at: true,
      status_views: true,
      notification_settings: true,
      created_at: true,
    },
  })

  if (!user) return null

  // Banned users should not be authenticated
  if (user.is_banned) return null

  return user
}

// Check if user has premium features
export function hasPremiumAccess(user: {
  is_premium: boolean
  is_premium_free: boolean
  is_early_adopter: boolean
}): boolean {
  return user.is_premium || user.is_premium_free || user.is_early_adopter
}
