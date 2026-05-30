# GNECT — Worklog & Project Bible

> **GNECT** — Privacy-first hookup web app for Tanzania's LGBTQ+ community.
> **NOT a dating app. NOT a social network. PURE hookup utility.**
> **Slogan:** No dating. No serious relationships. Just meet.
> **Flow:** Discover → Chat → Meet → Done → Close app

---

## PROJECT OVERVIEW

- **Name:** GNECT
- **Type:** PWA (Progressive Web App) — browser-based, add to home screen, no app store
- **Target:** Tanzania LGBTQ+ community (gay men specifically, with role classification)
- **Platform:** Next.js 16 + App Router + TypeScript
- **Database:** Prisma ORM + SQLite (building) → Turso (production)
- **Real-time:** Socket.io on HuggingFace Spaces cloud (carries message content for instant delivery, works for both local dev and production)
- **Media Storage:** Telegram via Cloudflare Workers proxy (bypasses TZ Telegram ban, works without VPN, 7-day auto-delete)
- **Style:** WhatsApp-inspired green UI, stripped down, FAST, privacy-first
- **Repo:** https://github.com/verliverli/gnect.git

---

## ADMIN ACCESS

- **Mechanism:** Stealth admin — logs in on the NORMAL user login page. If credentials match env vars → full admin access (BOSS MODE). No separate admin login page. No visible admin button.
- **Credentials:** Stored in environment variables ONLY (`ADMIN_NICKNAME` and `ADMIN_PASSWORD` in `.env`). NEVER hardcoded in source code. NEVER pushed to GitHub.
- **Admin Profile:** Shows ONLY name + BOSS MODE badge + "Boss mode — you run this app" message. NO role, NO bio, NO physical, NO tags, NO availability, NO photos. Admin is there for work, not hookup. Privacy + Account sections still visible for toggles and logout.

---

## CONFIRMED DECISIONS

| # | Topic | Decision |
|---|-------|----------|
| 1 | Stack | Next.js 16 + Prisma + SQLite for dev; Turso + cloud for production |
| 2 | Socket.io | Smart relay — carries message content for real-time, DB is source of truth on reconnect |
| 3 | View-once photos | Two options: 5 seconds and 10 seconds |
| 4 | Role change (free users) | Once per 60 days |
| 5 | Into/Identity tags | FULL list including "Can Host", "Looking for Place" |
| 6 | Phase order | 10 phases (0-9), Video Feed is Phase 7 (before Legal+Launch), Admin Panel is Phase 9 (before monetization), Premium is POST-DEPLOYMENT |
| 7 | Brand name | GNECT — final |
| 8 | Admin access | Stealth admin — same login page, special credentials unlock full admin panel |
| 9 | Admin profile | Admin has NO role, NO profile sections. Only name + BOSS badge. Admin is there for work, not hookup. |
| 10 | Premium timing | ALL features FREE at launch. Premium monetization is POST-DEPLOYMENT (after launch + getting users, no phase number — built when we have active users). We deploy, get users, THEN add premium. No premium gating until then. |
| 11 | Auto-delete | ALL auto-delete timers changed: hard limit is 7 days (was 14). Community posts: 7 days. Status: 24h. Chat text: 7 days. |
| 12 | Community (Ask) | Anonymous text-only Reddit-style posts. SFW/NSFW categories. Upvotes. 5 posts/day. Auto-delete 7 days. 2000 chars per post. |
| 13 | Quick Status | Text-only status on profile. Max 100 chars. Cute gradient backgrounds. Auto-delete 24h. 1 status at a time. |
| 14 | Discreet notifications | Push notifications show NO app name, NO message content. Just "🔔 New activity". User knows where it's from. |
| 15 | Admin broadcast | Uncancellable notifications. Only admin can delete. Users MUST see them. |
| 16 | Street filter | Users can add official street name for better nearby matching. Nearby only shows same-region users. "All Users" tab shows everyone in country (no filters, just browsing). |
| 17 | Cucumber size | Optional profile field. User chooses to show or not. For... research purposes 😂🥒 |
| 18 | Video Feed | TikTok-style vertical scroll, VIEW ONLY (no likes/comments/sharing), adult site APIs, VPN required, 3 categories: Gays / Trans Woman / Trans Man |
| 19 | Video hosting | NO video hosting — all content from adult APIs. Zero storage. Zero moderation for video. |
| 20 | Community anonymity | user_id stored in DB for rate limiting + My Posts tab + moderation. Display shows "Anonymous" — NO nickname, NO avatar. "You" badge shown only to post author. Admin can see who posted (Phase 9). |

---

## 6 SCREENS

1. **DISCOVER** — Browse nearby people as banner cards (vertical scroll)
2. **SPOTLIGHT** — Tap a banner → full profile view
3. **CHATS** — Conversation list + individual chat (WhatsApp-style)
4. **COMMUNITY** — Anonymous text posts (Ask), SFW/NSFW, upvotes, 7-day auto-delete
5. **VIDEO** — TikTok-style vertical scroll (view only, no actions, adult APIs)
6. **ME + SETTINGS** — Profile editing, toggles, privacy settings, legal

---

## KEY SPECS (Quick Reference)

### Auth
- Nickname + password only. No email. No phone.
- Age gate (18+). No captcha — bot prevention via honeypot, timing, IP rate limit, nickname filter
- JWT sessions (7-day expiry), HTTP-only cookies
- Admin auto-created on first login with admin credentials

### Profile
- Role (Top/Bottom/Versatile/Vers-Top/Vers-Bottom/Side), change once per 60 days (free)
- Into tags: up to 5 from 26 named presets
- Availability: Available Now / Tonight / This Week / Not Now
- Discretion mode, secret phrase, Not Today (hide 24h)
- Body type, height, weight, bio (300 chars max)
- Street name (official street name for better nearby matching, optional)
- Cucumber size 🥒 (optional — user chooses to show or not)

### Media Rules
- Photos only. Max 2MB. Telegram storage via Cloudflare Workers proxy.
- Profile: 2 free, 5 premium. Chat: send freely.
- Auto-delete: view-once (5/10 sec), unopened (30 min), opened (24h), text (7 days), hard limit (7 days)
- Community posts: auto-delete after 7 days
- Quick Status: auto-delete after 24h (configurable: 1h/3h/tonight/12h/24h)

### Discover
- Banner cards (NOT Tinder swipe), horizontal scroll
- **Nearby tab:** Only shows users in YOUR region. Filters available: role, age range, street, availability, body type, tags
- **All Users tab:** Shows everyone in the country. NO filters — just browsing. Simple nickname search.
- Street filter: match with people on the same street for close meets
- Sort (Nearby only): nearby, available now, newest, online only

### Chat (WhatsApp-style via Socket.io)
- Real-time messaging, read receipts (✓ ✓✓), typing indicator
- Quick replies, photo sending, view-once photos, ghost delete, unsend
- Swipe to reply, block from chat

### Video Feed (TikTok-style)
- Vertical scroll full-screen video feed — addiction driver 🔥
- **View ONLY** — no likes, no comments, no actions, no sharing. Watch and scroll.
- **No hosting** — all videos pulled from adult site APIs (saves storage + bandwidth)
- **VPN required** — these sites are blocked in Tanzania
- **3 categories:** Gays | Trans Woman | Trans Man
- Zero storage cost — streams directly from API, nothing saved on our servers

### Free vs Premium (DEFERRED TO PHASE 10 — POST-DEPLOYMENT)
- **ALL features are FREE at launch.** This is the "Freemium Test Version."
- Premium limits will be added in Phase 10 (POST-DEPLOYMENT) after we launch, deploy, and get users
- No premium gating, no upgrade prompts, no premium checks in code until Phase 10
- is_premium_free = TRUE stays until monetization phase
- First 100 users = early adopters (free premium forever when limits kick in)
- **We do NOT build premium features now. We build them AFTER deployment when we have users.**

### Privacy
- Panic button (fake safe page), incognito mode, discretion mode
- Anti-screenshot (best effort), ghost delete, block + report
- Auto-ban after 5 reports, rate limiting (30 actions/hour)

### Community (Ask)
- Anonymous text-only posts (Reddit-style). NO photos. NO nicknames shown.
- Two categories: SFW (Safe) and NSFW
- Feed tabs: New (latest) | Hot (most upvoted) | My Posts
- Upvote system — no downvotes, keep it positive
- 5 posts/day per user, max 2000 chars per post
- Optional region tag on posts (e.g., "📍 Dar es Salaam")
- Comments + replies on posts (also anonymous, also auto-delete 7 days)
- Auto-delete ALL posts + comments after 7 days
- Report posts (same report system)
- user_id stored in DB for rate limiting, My Posts tab, moderation — but NEVER shown to other users
- "You" badge visible only to post author on their own posts
- Admin cannot create community posts (admin is for work, not hookup)

### Quick Status
- Text-only status on user profile + Discover banner card
- Max 100 chars, emoji support
- Beautiful gradient backgrounds (auto-assigned, deterministic based on text)
- 1 status at a time — new one replaces old
- Configurable auto-delete: 1h / 3h / Tonight (until midnight) / 12h / 24h
- Quick preset library for one-tap status
- Status view counter (how many people saw your status)
- Shows on Discover banner card + Spotlight profile

### Discreet Push Notifications
- Web Push API (PWA) — user opts in
- Notification shows: "🔔 New activity" — NO app name, NO message content
- Anyone glancing at phone sees nothing identifying
- User knows it's from GNECT because they installed it
- Tap notification → opens app
- Quiet Hours: set DND window (e.g., 12am-7am), notifications queue up
- Smart batching: 5 messages in 1 min → ONE notification
- Category toggles: messages (on), community (off), profile views (off), profile saves (off)
- Admin broadcasts: ALWAYS ON, cannot disable
- Custom discreet notification sound

### Admin Broadcast (Uncancellable)
- Admin sends notification that users CANNOT dismiss
- Only admin can delete the notification
- Use cases: safety alerts, maintenance, new features, community rules
- Levels: Urgent (blocks screen, must acknowledge) vs Info (top banner, scrollable)
- Region targeting: send to specific regions only
- Broadcast analytics: see how many received/acknowledged
- Optional action button/link
- Scheduled broadcasts (write now, send later)

### Notification Center
- In-app notification drawer — tap bell icon to open
- 4 tabs: All, Chat, Community, Other
- Mark all read / mark single read
- Notification type icons with color coding
- Unread badge on bell icon in header
- Settings panel: toggles for each notification type, quiet hours

### Privacy Notifications
- Profile view notification: "Someone viewed your profile" — no name, just a count
- Profile save notification: "Someone saved your profile" — same discreet approach
- Screenshot detection: PrintScreen key detection → "Screenshot detected in a chat"

---

## DEPLOYMENT

- **Frontend:** Vercel (Next.js)
- **Real-time:** Socket.io on HuggingFace Spaces cloud
- **Media:** Telegram via Cloudflare Workers proxy (bypasses TZ Telegram ban, works without VPN)
- **Database:** Turso (libSQL) for production, SQLite for local dev

---

## 10-PHASE BUILD PLAN

### Phase 0: Foundation ✅
- Prisma schema + SQLite database
- JWT auth system with 7-day sessions
- Register / Login / Logout / Me endpoints
- Bot prevention (honeypot, timing, IP rate limit, nickname filter)
- Admin credential detection on register
- Socket.io mini-service

### Phase 1: Auth + Profile ✅
- Dark WhatsApp green theme
- Zustand auth store with session persistence
- Age gate + Register + Login forms
- App shell with swipe nav + floating text nav bar
- Profile panel: full-screen card UI, expandable sections, auto-save
- Profile update: bio, tags, role, not-today, photo upload
- Admin auto-create on first login + BOSS MODE badge
- Admin profile: ONLY name + BOSS badge (no role/bio/physical/tags/availability/photos)
- GNECT custom icon + PWA manifest
- Auto-login via JWT cookie

### Phase 2: Discover + Spotlight ✅
- Discover nearby users (same region ONLY) with grouped dropdown filters
- "All Users" tab: shows everyone in Tanzania, simple nickname search, Available-only toggle
- Street filter: match with same street for close meets
- Sort (Nearby only): nearby (same street first), available now, newest, online only
- Vertical scrollable banner cards — GNECT's own style
- Tap banner → full spotlight profile view
- Save/bookmark profiles
- Block + Report users (auto-block on report, 4 reasons)
- Auto-ban after 5 reports
- Discretion mode: blurred face pics in Discover + Spotlight, tap & hold to reveal
- Secret phrase gate for locked photos
- Admin NOT visible in Discover
- Cucumber size in inches (1-15, optional, show/hide toggle)
- 🔴 Pulsing "Available Now" green signal on banner cards + spotlight
- 🔥 Mutual interest highlight (shared into tags)
- 🆕 "New Here" badge for users < 7 days
- 📍 Proximity indicator (Same street / Same area)
- 📍 Region tag on every banner card + spotlight profile
- Quick status strip on banner cards with gradient background
- Pull-to-refresh on Discover
- Spotlight prev/next profile navigation with large round buttons
- Block = mutual invisibility (both directions hidden)
- 26 Into Tags across 4 categories
- Photo upload via Telegram + Cloudflare Workers (2MB max, JPEG/PNG/WebP)
- Photo management grid in profile panel (Face/Locked badges, hover-to-delete)

### Phase 3: Chat Engine ✅
- Real-time WhatsApp-style chat via Socket.io
- Chat list with avatar, nickname, last message, time, unread count
- Individual chat view with message bubbles (sent/received)
- Read receipts: ✓ sent, ✓✓ delivered, ✓✓ blue read
- Typing indicator animation
- Photo sending (upload via Telegram + Cloudflare Workers)
- View-once photos (blurred → tap → timer → gone)
- Quick replies bar
- Reply to specific message
- Unsend message
- Ghost delete (deleted for you, still visible to other person)
- Block/Report from chat
- Delete chat (both sides, no trace)
- 🖼️ Full-screen photo viewer (lightbox) — click any photo to view full size
- 🔴 Unread messages badge on Chats tab (real-time count, 99+ max)
- 👆 Swipe-to-reply gesture (60px threshold, Reply icon feedback)
- 🔒 Discrete mode on photos (tap & hold to reveal, smooth blur transition)
- NO chat limits (Freemium Test Version — all free, limits come in Phase 10)

### Phase 4: Community (Ask) ✅
- Anonymous text-only Reddit-style posts (NO photos, NO nicknames shown to other users)
- Two categories: SFW and NSFW
- Feed tabs: New (latest) | Hot (most upvoted) | My Posts
- Upvote toggle system (no downvotes — keep it positive)
- 5 posts per day per user, max 2000 chars per post
- Comments on posts (also anonymous, 500 chars max, auto-delete 7 days)
- Optional region tag on posts (user's region from profile)
- Auto-delete ALL posts + comments after 7 days
- Report posts (Spam, Harassment, Underage, Illegal, Other)
- Delete own posts + delete own comments
- "You" badge on own posts (visible only to post author)
- Admin cannot create posts or comments (admin is for work, not hookup)
- Community tab in bottom nav (Discover | Community | Chats)
- SFW/NSFW/All category filter pills
- FAB (+) button for creating new posts
- Pull-to-refresh gesture
- Infinite scroll with cursor-based pagination
- Empty states for each tab ("Be the first to ask something 🔥")
- Create post sheet with category picker, region tag toggle, character counter, daily post counter
- Full-screen post detail view with comments, upvote, delete, report

### Phase 5: Notifications + Quick Status ✅
- Quick Status: text-only status on profile + Discover banner, max 100 chars, emoji support, gradient backgrounds, 1 at a time, auto-delete (1h/3h/tonight/12h/24h), preset library, status view counter, availability auto-sync
- Notification Center: in-app notification drawer, 4 tabs (All/Chat/Community/Other), type icons + color coding, mark read (single + all), infinite scroll, notification settings toggles, quiet hours, unread bell badge
- Real-time push notifications via Socket.io: notification bell + unread count update instantly, chat tab unread badge updates in real-time from any screen, discreet sounds (Web Audio API), no polling delay
- Discreet push notifications (Web Push API/PWA): shows "🔔 New activity" only, no app name, no message content, VAPID encryption, smart batching, category toggles, quiet hours
- Admin uncancellable broadcast: users CANNOT dismiss, only admin deletes, urgent (full-screen modal) + info (Discover banner), region targeting, broadcast analytics, action button/link, BOSS MODE broadcast manager
- Privacy notifications: profile view alert, profile save alert, screenshot detection — all discreet, no identifying info
- Socket.io + media = cloud only (HuggingFace relay + Cloudflare Workers)
- Chat is uncensored — users free to say anything
- Link blocking: chat + community posts + comments — frontend + backend + chat service triple protection
- Nothing stored on HuggingFace — messages pass through RAM only

### Phase 6: Privacy + Safety ✅
- Panic Button: floating button at bottom-left → instant redirect to safe page
- Triple-Tap Header: tap GNECT logo 3 times fast → same panic redirect
- Safe Page (Calculator): built-in fake calculator at /safe/calculator, no GNECT branding
- Safe Page Picker: choose redirect destination — Calculator, BBC Sport, Wikipedia, Weather (Profile → Privacy)
- Anti-Screenshot — Blur on Focus Loss: entire app blurs when switching apps (prevents recent apps screenshot)
- Anti-Screenshot — PrintScreen Detection: red flash overlay + in-app screenshot notification
- Anti-Screenshot — View-Once Watermark: viewer's nickname overlaid at 7% opacity on view-once photos
- Anti-Screenshot — Right-Click Block: images can't be right-clicked to save (desktop)
- Anti-Screenshot — CSS Protections: user-select none, touch-callout none, pointer-events none on images
- Ghost Delete: delete message for you only, other person still sees it (long-press → "Delete for me")
- Unsend: delete message for both sides (long-press → "Unsend")
- Self-Destruct Timer: per-chat timer (Off/1h/3h/6h/24h) — clock icon in chat header
- Disappear Mode: hides chat content in chat list, shows "Tap to view" placeholder
- Discretion Mode: blurs face photos by default, tap & hold to reveal
- Secret Phrase: others must type this to see locked photos
- Stealth App Icon: PWA shows as "Calculator" on home screen instead of GNECT
- Discreet Notifications: push notifications disguised as Weather/News/Delivery updates
- Not Today: hide profile from Discover for 24 hours
- Session Manager: shows current device info + "Logout Everywhere" button
- Block + Report: block = mutual invisibility, report with reason, auto-ban after 5 reports
- Auto-Delete Enforcement: view-once (5/10s) → unopened media (30min) → opened media (24h) → text (7d) → hard limit (7d)
- Link Blocking: URLs blocked in chat, posts, comments — frontend + backend + chat service
- Privacy & Safety Guide: comprehensive help panel with 7 sections explaining every feature and how to access it (header ❓ icon + Profile → Privacy → guide button)

### Phase 7: Video Feed 🔥
- TikTok-style vertical scroll — full-screen video player, swipe up for next
- **View ONLY** — no likes, no comments, no bookmarks, no sharing. Pure watch + scroll.
- **No hosting** — pull videos from adult site APIs (no storage, no bandwidth cost, no CDN needed)
- **VPN required** — adult APIs blocked in TZ, user must have VPN to access this tab
- **3 categories:** Gays | Trans Woman | Trans Man (tabs at top, like Discover tabs)
- Auto-play on scroll into view, pause on scroll out
- Discretion mode: blur video when app loses focus (anti-shoulder-surfing)
- Not Today mode hides Video tab entirely
- Admin can toggle Video tab on/off globally
- Video tab only visible to logged-in users (age verified)
- No user-uploaded videos — API content only (zero moderation burden for video)
- Placeholder/thumbnail loading while video buffers
- "VPN Required" banner if user's region can't reach the API

### Phase 8: Legal + PWA + Launch ⏳
- Terms of Service page
- Privacy Policy page
- Age verification disclaimer
- PWA: service worker, offline support, install prompt, splash screen
- Performance: lazy loading, code splitting, skeleton states, smooth animations
- Accessibility: screen reader, keyboard nav, ARIA labels
- Error boundary + fallback UI
- Delete account flow (30-day grace period)
- **DEPLOY with ALL features FREE (Freemium Test Version)**

### Phase 9: Admin Panel ⏳
- Dashboard: total users, active today, new this week, chats, reports, community posts
- User management: search, view profiles, ban/unban, toggle premium
- Report viewer: pending reports, dismiss/warn/ban actions
- Uncancellable broadcast manager: create, delete, view acknowledgements, target all or region
- Community moderation: view reported posts, delete, ban from posting, pin/unpin
- App settings: toggle is_premium_free, early adopter count, rate limit stats
- Stealth access from profile panel (BOSS MODE section only)

### Premium Monetization 🔒 POST-DEPLOYMENT
> ⚠️ **DO NOT BUILD THIS PHASE UNTIL: app is deployed, live, and we have active users.**

- Free tier: 5 chats/week, 2 profile photos, blurred face pics, region-only
- Premium ($5.5/mo): unlimited chats, 5 photos, clear photos, incognito, verified badge
- Upgrade modal when hitting free limits
- Payment integration (M-Pesa, Flutterwave, or crypto)
- Incognito mode (Premium): hidden from Online filter, last_seen hidden
- Verified badge (Premium): checkmark on nickname
- Photo limits enforcement
- Profile views (Premium): see WHO viewed your profile
