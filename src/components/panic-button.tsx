'use client'

import { useEffect, useCallback, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { SAFE_PAGES } from '@/lib/constants'
import { useAuthStore } from '@/lib/store'

// ============================================
// PANIC BUTTON — Phase 6 Privacy Feature
// Floating button that instantly redirects to a safe page
// Triggers: tap, long-press, triple-tap on header
// ============================================

export function PanicButton() {
  const { user } = useAuthStore()

  // Derive safe page from user settings (no setState in effect)
  const safePageId = useMemo(() => {
    if (!user?.notification_settings) return 'calculator'
    try {
      const settings = JSON.parse(user.notification_settings)
      return settings.safePageId || 'calculator'
    } catch {
      return 'calculator'
    }
  }, [user?.notification_settings])

  // PANIC REDIRECT — the core function
  const triggerPanic = useCallback(() => {
    const safePage = SAFE_PAGES.find((p) => p.id === safePageId) || SAFE_PAGES.find((p) => p.id === 'calculator')!
    window.location.href = safePage.url
  }, [safePageId])

  // TRIPLE-TAP on GNECT header — handled by exposing a global function
  useEffect(() => {
    if (!user) return
    ;(window as any).__gnectPanic = triggerPanic
    return () => { delete (window as any).__gnectPanic }
  }, [user, triggerPanic])

  if (!user) return null

  return (
    <motion.button
      onClick={triggerPanic}
      onContextMenu={(e) => { e.preventDefault(); triggerPanic() }}
      className="fixed bottom-[58px] left-2 z-40 w-7 h-7 rounded-full bg-muted/40 flex items-center justify-center opacity-30 hover:opacity-60 active:opacity-100 transition-opacity"
      aria-label="Emergency exit"
      title="Emergency exit"
      whileTap={{ scale: 0.8 }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/60">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    </motion.button>
  )
}

// ============================================
// TRIPLE-TAP HEADER HOOK
// Attaches triple-tap detection to the GNECT header text
// ============================================

export function usePanicTripleTap() {
  const tapRef = useRef<{ count: number; lastTap: number }>({ count: 0, lastTap: 0 })

  const handleHeaderTap = useCallback(() => {
    const now = Date.now()
    if (now - tapRef.current.lastTap < 500) {
      tapRef.current.count++
      if (tapRef.current.count >= 3) {
        tapRef.current.count = 0
        // Trigger panic via global function
        if (typeof window !== 'undefined' && (window as any).__gnectPanic) {
          ;(window as any).__gnectPanic()
        }
      }
    } else {
      tapRef.current.count = 1
    }
    tapRef.current.lastTap = now
  }, [])

  return handleHeaderTap
}

// ============================================
// SAFE PAGE PICKER — For Profile Panel > Privacy
// ============================================

export function SafePagePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Panic Button Safe Page</p>
      <p className="text-xs text-muted-foreground">Where to redirect when panic button is pressed</p>
      <div className="flex flex-wrap gap-2">
        {SAFE_PAGES.map((page) => (
          <button
            key={page.id}
            onClick={() => onChange(page.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              value === page.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {page.name}
          </button>
        ))}
      </div>
    </div>
  )
}
