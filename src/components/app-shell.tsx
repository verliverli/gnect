'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Bell, Shield, Compass, MessageCircle, Users, EyeOff, HelpCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/lib/store'
import { useNotificationSocket } from '@/lib/use-notification-socket'
import { toast } from 'sonner'
import { DiscoverScreen } from '@/components/discover-screen'
import { ChatsScreen } from '@/components/chats-screen'
import { CommunityScreen } from '@/components/community-screen'
import { ProfilePanel } from '@/components/profile-panel'
import { NotificationCenter } from '@/components/notification-center'
import { BroadcastOverlay } from '@/components/broadcast-overlay'
import { PanicButton, usePanicTripleTap } from '@/components/panic-button'
import { PrivacyGuide } from '@/components/privacy-guide'

type Screen = 'discover' | 'community' | 'chats'

export function AppShell() {
  const { user, disappearMode, setDisappearMode } = useAuthStore()
  const [activeScreen, setActiveScreen] = useState<Screen>('discover')
  const [showProfile, setShowProfile] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showPrivacyGuide, setShowPrivacyGuide] = useState(false)

  // Phase 6: Blur on focus loss (anti-screenshot)
  const [appBlurred, setAppBlurred] = useState(false)

  // Phase 6: Screenshot deterrent flash
  const [showScreenshotFlash, setShowScreenshotFlash] = useState(false)

  // Phase 6: Triple-tap header for panic
  const handleHeaderTripleTap = usePanicTripleTap()

  // Chat state — supports opening chat from Spotlight
  const [chatWithUserId, setChatWithUserId] = useState<string | null>(null)
  const [chatKey, setChatKey] = useState(0) // Force re-mount when opening new chat
  const [chatOpenedFromDiscover, setChatOpenedFromDiscover] = useState(false) // Track if chat was opened from Discover
  const [totalUnread, setTotalUnread] = useState(0)
  const [notifUnread, setNotifUnread] = useState(0)
  const chatSocketRef = useRef<Socket | null>(null)
  const activeScreenRef = useRef<Screen>(activeScreen)

  // Keep screen ref in sync so the socket listener always has the latest
  useEffect(() => {
    activeScreenRef.current = activeScreen
  }, [activeScreen])

  const initial = user?.nickname?.charAt(0)?.toUpperCase() || '?'
  const isAdmin = user?.is_admin

  // Real-time notifications via Socket.io
  // Socket.io pushes notifications instantly for immediate UX
  // Polling every 60s is a fallback in case Socket.io misses events during reconnection
  useNotificationSocket(useCallback((notif) => {
    // Increment unread count instantly
    setNotifUnread((prev) => prev + 1)

    // Show a subtle toast for the notification
    toast(notif.title, {
      description: notif.body,
      duration: 3000,
    })
  }, []))

  // Real-time chat unread badge — Socket.io listener for when user is NOT on chats tab
  // When ChatsScreen is mounted (user on Chats tab), it handles its own unread count via fetchChats()
  // When ChatsScreen is NOT mounted (user on Discover/Community), we listen here to update the badge
  useEffect(() => {
    if (!user) return

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://verliverli-gnect.hf.space'
    const isExternalUrl = true // Always external — cloud-only architecture

    const socketOpts: Parameters<typeof io>[1] = {
      path: '/socket.io',
      query: { userId: user.id },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    }

    const socket = io(socketUrl, socketOpts)
    chatSocketRef.current = socket

    // Listen for chat-updated events to increment unread badge when not on Chats tab
    socket.on('chat-updated', () => {
      if (activeScreenRef.current !== 'chats') {
        setTotalUnread((prev) => prev + 1)
      }
    })

    // Listen for new-message events to increment unread badge when not on Chats tab
    socket.on('new-message', () => {
      if (activeScreenRef.current !== 'chats') {
        setTotalUnread((prev) => prev + 1)
      }
    })

    return () => {
      socket.disconnect()
      chatSocketRef.current = null
    }
  }, [user])

  // Fallback: Poll every 60s for unread count (in case Socket.io misses events)
  useEffect(() => {
    if (!user) return
    const fetchCount = () => {
      fetch('/api/notifications/unread-count', { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((d) => { if (d.ok) setNotifUnread(d.count) })
        .catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 60000)
    return () => clearInterval(interval)
  }, [user])

  // Register service worker for push notifications
  useEffect(() => {
    if (!user || !('serviceWorker' in navigator)) return

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')

        // Check if we already have a subscription
        const existingSub = await registration.pushManager.getSubscription()
        if (existingSub) return

        // Subscribe to push if VAPID key is available
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) return

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        })

        // Send subscription to server
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: subscription.toJSON().keys,
            deviceInfo: navigator.userAgent.slice(0, 100),
          }),
          credentials: 'same-origin',
        })
      } catch {
        // Push subscription likely denied by user — that's fine
      }
    }
    registerSW()
  }, [user])

  // Phase 6: Enhanced screenshot detection + blur on focus loss
  useEffect(() => {
    if (!user) return

    const handleScreenshot = () => {
      // Show deterrent flash
      setShowScreenshotFlash(true)
      setTimeout(() => setShowScreenshotFlash(false), 2000)

      // Notify via API
      fetch('/api/notifications/screenshot', {
        method: 'POST',
        credentials: 'same-origin',
      }).catch(() => {})
    }

    // Detect PrintScreen key
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        handleScreenshot()
      }
    }

    // Blur on focus loss (prevents screenshots in recent apps)
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setAppBlurred(true)
      } else {
        setAppBlurred(false)
      }
    }

    // Disable right-click context menu on images
    const handleContextMenu = (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'IMG') {
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    document.addEventListener('visibilitychange', handleVisibility)
    document.addEventListener('contextmenu', handleContextMenu)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('visibilitychange', handleVisibility)
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [user])

  // Open chat with a specific user (from Spotlight Message button)
  const openChatWithUser = useCallback((userId: string) => {
    setChatWithUserId(userId)
    setChatKey((prev) => prev + 1)
    setChatOpenedFromDiscover(true) // Mark that this came from Discover
    setActiveScreen('chats')
  }, [])

  // Clear chat target after it's been consumed by ChatsScreen
  const clearChatWithUser = useCallback(() => {
    setChatWithUserId(null)
    setChatOpenedFromDiscover(false)
  }, [])

  return (
    <div className={`h-dvh flex flex-col bg-background overflow-hidden ${appBlurred ? 'app-blur-overlay' : ''}`}>
      {/* Broadcast Overlay — handles urgent/info broadcasts */}
      <BroadcastOverlay />

      {/* Top Bar */}
      <header className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-primary/10 border-b border-primary/20 z-10 shrink-0">
        {/* Avatar + admin badge */}
        <button
          onClick={() => setShowProfile(true)}
          className="relative h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
          aria-label="Open profile"
        >
          <span className="text-sm font-semibold text-primary">{initial}</span>
          {/* Online dot */}
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-primary border-2 border-primary/10" />
          {/* Admin shield badge */}
          {isAdmin && (
            <span className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-primary flex items-center justify-center border-2 border-primary/10">
              <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary-foreground" />
            </span>
          )}
        </button>

        {/* Brand — triple-tap triggers panic (Phase 6) */}
        <div className="flex flex-col items-center" onClick={handleHeaderTripleTap}>
          <span className="text-sm font-bold tracking-widest text-primary/80">GNECT</span>
          {isAdmin && (
            <span className="text-[9px] font-semibold tracking-wider text-primary/50 uppercase">Boss Mode</span>
          )}
          {/* Disappear mode indicator */}
          {disappearMode && (
            <span className="text-[8px] font-semibold tracking-wider text-yellow-500 uppercase flex items-center gap-0.5">
              <EyeOff className="w-2.5 h-2.5" /> Disappear
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {/* Help / Privacy Guide button */}
          <button
            onClick={() => setShowPrivacyGuide(true)}
            className="relative h-10 w-10 rounded-full flex items-center justify-center active:bg-primary/10 transition-colors"
            aria-label="Privacy guide"
          >
            <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary/70" />
          </button>

          {/* Notification bell with unread badge */}
          <button
            onClick={() => setShowNotifications(true)}
            className="relative h-10 w-10 rounded-full flex items-center justify-center active:bg-primary/10 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-primary/70" />
            {notifUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                {notifUnread > 99 ? '99+' : notifUnread}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Content Area — NO swipe, just tab switch */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScreen}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0"
          >
            {activeScreen === 'discover' ? (
              <DiscoverScreen onOpenChat={openChatWithUser} />
            ) : activeScreen === 'community' ? (
              <CommunityScreen />
            ) : (
              <ChatsScreen key={chatKey} openChatWithUserId={chatWithUserId} onChatOpened={clearChatWithUser} onUnreadCountChange={setTotalUnread} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Tab Bar — big, prominent, mobile-friendly */}
      <div className="shrink-0 flex items-center border-t border-border bg-background/95 backdrop-blur-md z-10 safe-bottom">
        <button
          onClick={() => setActiveScreen('discover')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[52px] transition-colors relative ${
            activeScreen === 'discover' ? 'text-primary' : 'text-muted-foreground/50'
          }`}
          aria-label="Discover screen"
        >
          <Compass className={`w-5 h-5 ${activeScreen === 'discover' ? 'text-primary' : ''}`} />
          <span className={`text-[10px] font-semibold ${activeScreen === 'discover' ? 'text-primary' : ''}`}>
            Discover
          </span>
          {activeScreen === 'discover' && (
            <motion.div
              layoutId="bottom-tab-indicator"
              className="absolute top-0 left-2 right-2 h-0.5 bg-primary rounded-full"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </button>
        <button
          onClick={() => setActiveScreen('community')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[52px] transition-colors relative ${
            activeScreen === 'community' ? 'text-primary' : 'text-muted-foreground/50'
          }`}
          aria-label="Community screen"
        >
          <Users className={`w-5 h-5 ${activeScreen === 'community' ? 'text-primary' : ''}`} />
          <span className={`text-[10px] font-semibold ${activeScreen === 'community' ? 'text-primary' : ''}`}>
            Community
          </span>
          {activeScreen === 'community' && (
            <motion.div
              layoutId="bottom-tab-indicator"
              className="absolute top-0 left-2 right-2 h-0.5 bg-primary rounded-full"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </button>
        <button
          onClick={() => {
            // When clicking Chats tab directly (NOT from Discover),
            // clear chatWithUserId so it doesn't auto-open a chat
            if (chatOpenedFromDiscover) {
              setChatWithUserId(null)
              setChatOpenedFromDiscover(false)
            }
            setActiveScreen('chats')
          }}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[52px] transition-colors relative ${
            activeScreen === 'chats' ? 'text-primary' : 'text-muted-foreground/50'
          }`}
          aria-label="Chats screen"
        >
          <div className="relative">
            <MessageCircle className={`w-5 h-5 ${activeScreen === 'chats' ? 'text-primary' : ''}`} />
            {totalUnread > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <span className={`text-[10px] font-semibold ${activeScreen === 'chats' ? 'text-primary' : ''}`}>
            Chats
          </span>
          {activeScreen === 'chats' && (
            <motion.div
              layoutId="bottom-tab-indicator"
              className="absolute top-0 left-2 right-2 h-0.5 bg-primary rounded-full"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </button>
      </div>

      {/* Profile Panel */}
      <AnimatePresence>
        {showProfile && <ProfilePanel onClose={() => setShowProfile(false)} />}
      </AnimatePresence>

      {/* Notification Center */}
      <AnimatePresence>
        {showNotifications && <NotificationCenter onClose={() => setShowNotifications(false)} />}
      </AnimatePresence>

      {/* Phase 6: Panic Button — floating, subtle */}
      <PanicButton />

      {/* Privacy & Safety Guide */}
      <AnimatePresence>
        {showPrivacyGuide && <PrivacyGuide onClose={() => setShowPrivacyGuide(false)} />}
      </AnimatePresence>

      {/* Phase 6: Screenshot deterrent flash overlay */}
      <AnimatePresence>
        {showScreenshotFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-destructive/90 flex items-center justify-center screenshot-flash"
          >
            <div className="text-center">
              <span className="text-6xl">🚫</span>
              <p className="text-destructive-foreground text-xl font-bold mt-4">Screenshot blocked</p>
              <p className="text-destructive-foreground/70 text-sm mt-1">Content is protected</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
