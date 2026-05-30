'use client'

import { useState, useCallback } from 'react'
import { Clock, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

// ============================================
// CHAT SELF-DESTRUCT TIMER — Phase 6 Privacy Feature
// Timer button in chat header to set message auto-delete
// ============================================

const TIMER_OPTIONS = [
  { label: 'Off', hours: 0 },
  { label: '1 hour', hours: 1 },
  { label: '3 hours', hours: 3 },
  { label: '6 hours', hours: 6 },
  { label: '24 hours', hours: 24 },
] as const

interface ChatSelfDestructProps {
  chatId: string
  activeHours: number | null
  onSetTimer: (hours: number) => void
}

export function ChatSelfDestruct({ chatId, activeHours, onSetTimer }: ChatSelfDestructProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [setting, setSetting] = useState(false)

  const handleSelect = useCallback(async (hours: number) => {
    setSetting(true)
    try {
      const res = await fetch(`/api/chat/${chatId}/self-destruct`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        onSetTimer(hours)
        toast.success(hours > 0 ? `Self-destruct set: ${hours}h` : 'Self-destruct timer removed')
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSetting(false)
      setShowPicker(false)
    }
  }, [chatId, onSetTimer])

  return (
    <div className="relative">
      {/* Timer button in chat header */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
          activeHours ? 'bg-primary/20 text-primary' : 'hover:bg-secondary text-muted-foreground'
        }`}
        aria-label="Self-destruct timer"
      >
        <Clock className="w-4 h-4" />
      </button>

      {/* Active indicator dot */}
      {activeHours && (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
      )}

      {/* Timer picker dropdown */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-10 z-50 w-40 rounded-xl border border-border bg-popover shadow-lg overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Self-Destruct</span>
                <button onClick={() => setShowPicker(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="py-1">
              {TIMER_OPTIONS.map((opt) => (
                <button
                  key={opt.hours}
                  onClick={() => handleSelect(opt.hours)}
                  disabled={setting}
                  className={`w-full px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors flex items-center justify-between ${
                    (activeHours ?? 0) === opt.hours ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
                  }`}
                >
                  <span>{opt.label}</span>
                  {(activeHours ?? 0) === opt.hours && (
                    <span className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
