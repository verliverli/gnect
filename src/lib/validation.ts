// ============================================
// GNECT VALIDATION UTILITIES
// Input validation + bot prevention
// ============================================

import {
  NICKNAME_RULES,
  RATE_LIMITS,
  ALL_REGIONS,
  ROLES,
  BODY_TYPES,
  INTO_TAGS,
} from "./constants"

// Validate nickname format
export function validateNickname(
  nickname: string
): { valid: boolean; error?: string } {
  if (nickname.length < NICKNAME_RULES.MIN_LENGTH) {
    return { valid: false, error: `Min ${NICKNAME_RULES.MIN_LENGTH} characters` }
  }
  if (nickname.length > NICKNAME_RULES.MAX_LENGTH) {
    return { valid: false, error: `Max ${NICKNAME_RULES.MAX_LENGTH} characters` }
  }
  if (!NICKNAME_RULES.PATTERN.test(nickname)) {
    return { valid: false, error: "Only letters, numbers, and underscores" }
  }

  // Bot pattern check
  if (isBotNickname(nickname)) {
    return { valid: false, error: "Nickname pattern not allowed" }
  }

  return { valid: true }
}

// Validate password
export function validatePassword(
  password: string
): { valid: boolean; error?: string } {
  if (password.length < 6) {
    return { valid: false, error: "Password must be at least 6 characters" }
  }
  return { valid: true }
}

// Validate age (must be 18+)
export function validateAge(age: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(age) || age < 18) {
    return { valid: false, error: "You must be at least 18 years old" }
  }
  if (age > 120) {
    return { valid: false, error: "Please enter a valid age" }
  }
  return { valid: true }
}

// Validate region
export function validateRegion(region: string): boolean {
  return (ALL_REGIONS as readonly string[]).includes(region)
}

// Validate role
export function validateRole(role: string): boolean {
  return (ROLES as readonly string[]).includes(role)
}

// Validate body type
export function validateBodyType(bodyType: string): boolean {
  return (BODY_TYPES as readonly string[]).includes(bodyType)
}

// Validate into tags (max 5, must be from preset list)
export function validateIntoTags(
  tags: string[]
): { valid: boolean; error?: string } {
  if (tags.length > 5) {
    return { valid: false, error: "Maximum 5 tags allowed" }
  }
  const tagSet = new Set(INTO_TAGS as readonly string[])
  for (const tag of tags) {
    if (!tagSet.has(tag)) {
      return { valid: false, error: `Invalid tag: ${tag}` }
    }
  }
  return { valid: true }
}

// Enhanced bot pattern detection (unified — used by both register and check-nickname)
export function isBotNickname(nickname: string): boolean {
  const lower = nickname.toLowerCase()
  // All same characters (e.g., "aaaa", "1111")
  if (new Set(lower).size === 1) return true
  // All digits (e.g., "123456")
  if (/^\d+$/.test(lower)) return true
  // 3+ sequential chars anywhere (e.g., "abc", "123")
  let sequential = 0
  for (let i = 1; i < lower.length; i++) {
    if (lower.charCodeAt(i) - lower.charCodeAt(i - 1) === 1) {
      sequential++
      if (sequential >= 3) return true
    } else {
      sequential = 0
    }
  }
  // Repeated short segments (e.g., "ababab")
  if (nickname.length >= 6) {
    const half = nickname.slice(0, Math.floor(nickname.length / 2))
    if (half + half === nickname) return true
  }
  return false
}

// Validate bio (max 300 chars)
export function validateBio(bio: string): { valid: boolean; error?: string } {
  if (bio.length > 300) {
    return { valid: false, error: "Bio must be 300 characters or less" }
  }
  return { valid: true }
}

// Honeypot check — if hidden field has a value, it's a bot
export function isHoneypotTriggered(honeypotValue: string | undefined): boolean {
  return !!honeypotValue && honeypotValue.length > 0
}

// Timing check — reject if form submitted too fast (bot indicator)
export function isTimingTooFast(startTime: number): boolean {
  return Date.now() - startTime < RATE_LIMITS.MIN_REGISTER_TIME_MS
}
