// ============================================
// GNECT CONSTANTS
// All preset lists, enums, and configuration
// ============================================

// Tanzania Regions
export const TANZANIA_MAINLAND_REGIONS = [
  "Arusha",
  "Dar es Salaam",
  "Dodoma",
  "Geita",
  "Iringa",
  "Kagera",
  "Katavi",
  "Kigoma",
  "Kilimanjaro",
  "Lindi",
  "Manyara",
  "Mara",
  "Mbeya",
  "Morogoro",
  "Mtwara",
  "Mwanza",
  "Njombe",
  "Pwani",
  "Rukwa",
  "Ruvuma",
  "Shinyanga",
  "Simiyu",
  "Singida",
  "Songwe",
  "Tabora",
  "Tanga",
] as const

export const ZANZIBAR_REGIONS = [
  "Mjini Magharibi",
  "Kaskazini Unguja",
  "Kusini Unguja",
  "Kaskazini Pemba",
  "Kusini Pemba",
] as const

export const ALL_REGIONS = [...TANZANIA_MAINLAND_REGIONS, ...ZANZIBAR_REGIONS] as const

export type TanzaniaRegion = typeof ALL_REGIONS[number]

// Roles
export const ROLES = [
  "Top",
  "Bottom",
  "Versatile",
  "Vers-Top",
  "Vers-Bottom",
  "Side",
] as const

export type Role = typeof ROLES[number]

// Body Types
export const BODY_TYPES = [
  "Slim",
  "Athletic",
  "Average",
  "Stocky",
  "Chub",
  "Bear",
] as const

export type BodyType = typeof BODY_TYPES[number]

// Into/Identity Tags — 24 named tags for wider choice
// Body types are a SEPARATE field, not duplicated here
export const INTO_TAGS = [
  // Sexual interests
  "Oral",
  "Anal",
  "Kink",
  "Group Fun",
  "BDSM",
  "Roleplay",
  "Massage",
  "Foot Play",
  "Wrestling",
  "Voyeur",
  "Exhibition",
  // Identity / Vibe
  "Twink",
  "Daddy",
  "Jock",
  "Nerdy",
  "Punk",
  "Raver",
  "Crossdresser",
  "Curious",
  "Furry",
  // Location / Logistics
  "Can Host",
  "Need Place",
  "Car Fun",
  "Hotel Meet",
  // Discretion
  "Discreet",
  "Public Meet",
] as const

export type IntoTag = typeof INTO_TAGS[number]

// Availability Statuses
export const AVAILABILITY_STATUSES = [
  "Available Now",
  "Tonight",
  "This Week",
  "Not Now",
] as const

export type AvailabilityStatus = typeof AVAILABILITY_STATUSES[number]

// Report Reasons
export const REPORT_REASONS = [
  "Fake",
  "Spam",
  "Underage",
  "Harassment",
] as const

export type ReportReason = typeof REPORT_REASONS[number]

// Quick Reply Messages
export const QUICK_REPLIES = [
  "My place",
  "Your place?",
  "On my way",
  "Can't now",
  "Send pic",
  "Available?",
  "👋",
] as const

// Safe Pages (for Panic Button)
export const SAFE_PAGES = [
  { id: "bbc_sport", name: "BBC Sport", url: "https://www.bbc.com/sport" },
  { id: "wikipedia", name: "Wikipedia", url: "https://www.wikipedia.org" },
  { id: "calculator", name: "Calculator", url: "/safe/calculator" },
  { id: "weather", name: "Weather", url: "https://www.weather.com" },
] as const

// Media Limits
export const MEDIA_LIMITS = {
  MAX_PHOTO_SIZE_BYTES: 2 * 1024 * 1024, // 2MB
  MAX_FREE_PROFILE_PHOTOS: 2,
  MAX_PREMIUM_PROFILE_PHOTOS: 5,
  MAX_INTO_TAGS: 5,
  VIEW_ONCE_DURATIONS: [5, 10], // seconds
  UNOPENED_MEDIA_DELETE_MINUTES: 30,
  OPENED_MEDIA_DELETE_HOURS: 24,
  CHAT_TEXT_DELETE_DAYS: 7,
  HARD_DELETE_DAYS: 7,
} as const

// Rate Limits
export const RATE_LIMITS = {
  MAX_IP_REGS_PER_24H: 3,
  MAX_ACTIONS_PER_HOUR: 30,
  MIN_REGISTER_TIME_MS: 2000, // 2 seconds (honeypot timing)
  MAX_REPORTS_BEFORE_BAN: 5,
  FREE_CHATS_PER_WEEK: 5,
  FREE_NOT_TODAY_PER_DAY: 1,
  ROLE_CHANGE_FREE_DAYS: 60,
  ROLE_CHANGE_PREMIUM_DAYS: 30,
} as const

// Nickname Rules
export const NICKNAME_RULES = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 20,
  PATTERN: /^[a-zA-Z0-9_]+$/, // alphanumeric + underscore only
} as const

// Admin credentials are stored in environment variables for security.
// ADMIN_NICKNAME and ADMIN_PASSWORD must be set in .env
// Never hardcode credentials in source code.

// Catbox API
export const CATBOX_API = {
  UPLOAD_URL: "https://catbox.moe/user/api.php",
  DELETE_URL: "https://catbox.moe/user/api.php",
} as const

// Cloudflare Worker — Telegram media proxy (bypasses Tanzania Telegram ban)
export const MEDIA_WORKER = {
  URL: process.env.CLOUDFLARE_WORKER_URL || "https://gnect-media-worker.03mrfrancis.workers.dev",
  ENDPOINTS: {
    UPLOAD: "/upload",
    FILE: "/file",
  },
} as const

// Media URL helper — handles both old Catbox URLs and new Telegram file_ids
// Telegram file_ids are stored with "tg:" prefix in the database
export function getMediaUrl(storedUrl: string | null): string | null {
  if (!storedUrl) return null
  // Old Catbox URLs — return as-is (backward compatibility)
  if (storedUrl.startsWith("https://")) return storedUrl
  // Telegram file_id — construct Worker URL
  if (storedUrl.startsWith("tg:")) {
    const fileId = storedUrl.slice(3) // Remove "tg:" prefix
    return `${MEDIA_WORKER.URL}${MEDIA_WORKER.ENDPOINTS.FILE}/${fileId}`
  }
  // Unknown format — return as-is
  return storedUrl
}

// ============================================
// QUICK STATUS — Phase 5
// ============================================

export const STATUS_PRESETS = [
  { text: "Looking for fun tonight 🔥", duration: "tonight" },
  { text: "Hosting rn 🏠", duration: "1h" },
  { text: "Need a place 📍", duration: "3h" },
  { text: "Chill vibes only 😎", duration: "24h" },
  { text: "Not looking, just browsing 👀", duration: "24h" },
  { text: "Available now 💚", duration: "1h" },
  { text: "Car fun 🚗", duration: "3h" },
  { text: "Hotel meet 🏨", duration: "tonight" },
  { text: "New here, say hi 👋", duration: "24h" },
  { text: "Discreet only 🤫", duration: "24h" },
] as const

export const STATUS_DURATIONS = [
  { label: "1 hour", value: "1h", ms: 60 * 60 * 1000 },
  { label: "3 hours", value: "3h", ms: 3 * 60 * 60 * 1000 },
  { label: "Tonight", value: "tonight", ms: 0 }, // special: until midnight TZ
  { label: "12 hours", value: "12h", ms: 12 * 60 * 60 * 1000 },
  { label: "24 hours", value: "24h", ms: 24 * 60 * 60 * 1000 },
] as const

// ============================================
// LINK DETECTION — Security filter
// Block URLs in chat + community (phishing, spam, doxxing)
// Users are free to say anything — only links are blocked
// ============================================

export const LINK_PATTERN = /https?:\/\/|www\.[a-z0-9-]+\.[a-z]{2,}|[a-z0-9-]+\.(com|net|org|tz|io|co|me|info|xyz|app|dev|cc|tv|ly|gl|bit|tiny|shorty|rebrand|smarturl|click|link|url|page|site|web|online|shop|store|buzz|zone|space|live|world|life|club|fun|top|one|mobi|pro|tech|design|studio|agency)\b/i

export function containsLink(text: string | null | undefined): boolean {
  if (!text) return false
  return LINK_PATTERN.test(text)
}

// Notification types
export const NOTIFICATION_TYPES = {
  MESSAGE: "message",
  COMMUNITY: "community",
  PROFILE_VIEW: "profile_view",
  PROFILE_SAVE: "profile_save",
  ADMIN_BROADCAST: "admin_broadcast",
  SCREENSHOT: "screenshot",
} as const

// Broadcast levels
export const BROADCAST_LEVELS = {
  URGENT: "urgent",
  INFO: "info",
} as const

// Default notification settings
export const DEFAULT_NOTIFICATION_SETTINGS = {
  messages: true,
  community: false,
  profileViews: false,
  profileSaves: false,
  quietHoursEnabled: false,
  quietHoursStart: "23:00",
  quietHoursEnd: "07:00",
} as const
