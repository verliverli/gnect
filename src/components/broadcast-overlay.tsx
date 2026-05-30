'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, AlertTriangle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Broadcast {
  id: string
  title: string
  message: string
  level: string
  action_label: string | null
  action_url: string | null
  created_at: string
  is_acknowledged: boolean
}

export function BroadcastOverlay() {
  const [urgentBroadcasts, setUrgentBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBroadcasts = useCallback(async () => {
    try {
      const res = await fetch('/api/broadcasts/active', { credentials: 'same-origin' })
      const data = await res.json()
      if (data.ok) {
        setUrgentBroadcasts(data.urgent || [])
        // Info banners are shown in DiscoverScreen — not here
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBroadcasts()
    const interval = setInterval(fetchBroadcasts, 30000)
    return () => clearInterval(interval)
  }, [fetchBroadcasts])

  const acknowledge = useCallback(async (broadcastId: string) => {
    try {
      await fetch(`/api/broadcasts/${broadcastId}/acknowledge`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      setUrgentBroadcasts((prev) => prev.filter((b) => b.id !== broadcastId))
    } catch {
      // silent
    }
  }, [])

  const currentUrgent = urgentBroadcasts[0]

  // Only render the URGENT full-screen overlay
  // Info banners are now rendered in DiscoverScreen as uncancellable banners
  return (
    <AnimatePresence>
      {currentUrgent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-card border border-yellow-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-yellow-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-xs font-semibold text-yellow-400 uppercase">Admin Alert</span>
                </div>
                <h3 className="text-base font-bold mt-0.5">{currentUrgent.title}</h3>
              </div>
            </div>

            {/* Message */}
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {currentUrgent.message}
            </p>

            {/* Action button if present */}
            {currentUrgent.action_label && currentUrgent.action_url && (
              <Button
                variant="outline"
                className="w-full rounded-xl h-11 gap-2"
                onClick={() => window.open(currentUrgent.action_url!, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
                {currentUrgent.action_label}
              </Button>
            )}

            {/* Acknowledge button */}
            <Button
              className="w-full rounded-xl h-12 bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
              onClick={() => acknowledge(currentUrgent.id)}
            >
              I Understand
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
