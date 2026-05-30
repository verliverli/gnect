// ============================================
// GNECT RATE LIMITING UTILITIES
// IP registration limits + action rate limits
// ============================================

import { db } from "./db"
import { RATE_LIMITS } from "./constants"

// Check if IP is under the 24h registration limit
export async function checkIPRegistrationLimit(
  ip: string
): Promise<boolean> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const count = await db.iPRegistration.count({
    where: {
      ip_address: ip,
      registered_at: { gte: twentyFourHoursAgo },
    },
  })

  return count < RATE_LIMITS.MAX_IP_REGS_PER_24H
}

// Record a new IP registration
export async function recordIPRegistration(ip: string): Promise<void> {
  await db.iPRegistration.create({
    data: { ip_address: ip },
  })
}

// Check if user action is under the hourly rate limit
export async function checkActionRateLimit(
  userId: string,
  actionType: string
): Promise<boolean> {
  const entry = await db.rateLimit.findUnique({
    where: { user_id_action_type: { user_id: userId, action_type: actionType } },
  })

  if (!entry) return true

  // Check if the hour window has expired — if so, limit resets
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  if (entry.hour_window_start < oneHourAgo) return true

  return entry.action_count < RATE_LIMITS.MAX_ACTIONS_PER_HOUR
}

// Increment or create the action rate limit counter
export async function incrementActionRateLimit(
  userId: string,
  actionType: string
): Promise<void> {
  const existing = await db.rateLimit.findUnique({
    where: { user_id_action_type: { user_id: userId, action_type: actionType } },
  })

  if (!existing) {
    await db.rateLimit.create({
      data: { user_id: userId, action_type: actionType, action_count: 1 },
    })
    return
  }

  // Reset counter if the hour window has expired
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  if (existing.hour_window_start < oneHourAgo) {
    await db.rateLimit.update({
      where: { id: existing.id },
      data: { action_count: 1, hour_window_start: new Date() },
    })
    return
  }

  await db.rateLimit.update({
    where: { id: existing.id },
    data: { action_count: { increment: 1 } },
  })
}

// Login rate limiting (per nickname, max 5 attempts per 15 minutes)
const loginAttempts = new Map<string, { count: number; windowStart: number }>()
const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

export function checkLoginRateLimit(nickname: string): boolean {
  const entry = loginAttempts.get(nickname)
  if (!entry) return true
  if (Date.now() - entry.windowStart > LOGIN_WINDOW_MS) return true
  return entry.count < MAX_LOGIN_ATTEMPTS
}

export function recordLoginAttempt(nickname: string): void {
  const entry = loginAttempts.get(nickname)
  if (!entry || Date.now() - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(nickname, { count: 1, windowStart: Date.now() })
    return
  }
  entry.count++
}

export function clearLoginAttempts(nickname: string): void {
  loginAttempts.delete(nickname)
}

// Clean up expired entries (call periodically)
export function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [key, entry] of loginAttempts.entries()) {
    if (now - entry.windowStart > LOGIN_WINDOW_MS) {
      loginAttempts.delete(key)
    }
  }
}

// Clean up expired rate limit entries (older than 1 hour)
export async function cleanupRateLimits(): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  await db.rateLimit.deleteMany({
    where: { hour_window_start: { lt: oneHourAgo } },
  })

  // Also clean up old IP registration records (older than 24h)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  await db.iPRegistration.deleteMany({
    where: { registered_at: { lt: twentyFourHoursAgo } },
  })
}
