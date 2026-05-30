'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Megaphone, Plus, Trash2, Loader2, Send, Target,
  AlertTriangle, Info, BarChart3, Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/lib/store'
import { ALL_REGIONS } from '@/lib/constants'
import { toast } from 'sonner'

interface Broadcast {
  id: string
  title: string
  message: string
  level: string
  target_region: string | null
  action_label: string | null
  action_url: string | null
  is_sent: boolean
  sent_at: string | null
  scheduled_at: string | null
  ack_count: number
  total_users: number
  created_at: string
}

export function AdminBroadcastPanel() {
  const { user } = useAuthStore()
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  // Create form state
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [level, setLevel] = useState<'info' | 'urgent'>('info')
  const [targetRegion, setTargetRegion] = useState('')
  const [actionLabel, setActionLabel] = useState('')
  const [actionUrl, setActionUrl] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchBroadcasts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/broadcast', { credentials: 'same-origin' })
      const data = await res.json()
      if (data.ok) setBroadcasts(data.data || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBroadcasts()
  }, [fetchBroadcasts])

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message required')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          level,
          target_region: targetRegion || null,
          action_label: actionLabel.trim() || null,
          action_url: actionUrl.trim() || null,
        }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Broadcast sent!')
        setTitle('')
        setMessage('')
        setLevel('info')
        setTargetRegion('')
        setActionLabel('')
        setActionUrl('')
        setShowCreate(false)
        fetchBroadcasts()
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/broadcast/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Broadcast deleted')
        fetchBroadcasts()
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    }
  }

  if (!user?.is_admin) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          Broadcast Manager
        </h3>
        <Button
          size="sm"
          className="rounded-xl h-8 gap-1.5 text-xs"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </Button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Broadcast title..."
                className="h-10 rounded-xl text-sm"
                maxLength={100}
              />
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message..."
                className="rounded-xl text-sm resize-none"
                rows={3}
                maxLength={500}
              />

              {/* Level toggle */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Level:</span>
                <button
                  onClick={() => setLevel('info')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    level === 'info' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  <Info className="w-3 h-3 inline mr-1" />Info
                </button>
                <button
                  onClick={() => setLevel('urgent')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    level === 'urgent' ? 'bg-yellow-500 text-black' : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3 inline mr-1" />Urgent
                </button>
              </div>

              {/* Region targeting */}
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Target Region (empty = all)</span>
                <select
                  value={targetRegion}
                  onChange={(e) => setTargetRegion(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-card text-sm mt-1"
                >
                  <option value="">All Regions</option>
                  {ALL_REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Optional action */}
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={actionLabel}
                  onChange={(e) => setActionLabel(e.target.value)}
                  placeholder="Action label (optional)"
                  className="h-10 rounded-xl text-sm"
                />
                <Input
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  placeholder="Action URL (optional)"
                  className="h-10 rounded-xl text-sm"
                />
              </div>

              <Button
                className="w-full rounded-xl h-11 font-bold"
                onClick={handleCreate}
                disabled={creating || !title.trim() || !message.trim()}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Send Broadcast
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Broadcast List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : broadcasts.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No broadcasts yet</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto gnect-scroll">
          {broadcasts.map((b) => (
            <div key={b.id} className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {b.level === 'urgent' ? (
                      <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" />
                    ) : (
                      <Info className="w-3 h-3 text-primary shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">{b.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{b.message}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      {b.ack_count}/{b.total_users} seen
                    </span>
                    {b.target_region && (
                      <span className="text-[10px] text-primary flex items-center gap-1">
                        <Target className="w-3 h-3" /> {b.target_region}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(b.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
