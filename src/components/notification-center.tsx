'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Bell, BellOff, MessageCircle, Users, Eye, Bookmark,
  Shield, AlertTriangle, Camera, Check, CheckCheck, Trash2,
  Settings, Clock, Loader2, Volume2, VolumeX, ChevronDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

// ============================================
// Types
// ============================================

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, any> | null
  is_read: boolean
  created_at: string
}

interface NotificationSettings {
  messages: boolean
  community: boolean
  profileViews: boolean
  profileSaves: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
}

type NotificationTab = 'all' | 'messages' | 'community' | 'other'

// ============================================
// Helper: relative time
// ============================================

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  if (diffMs < 0) return 'now'
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yest'
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ============================================
// Notification Icon by Type
// ============================================

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case 'message': return <MessageCircle className="w-4 h-4 text-primary" />
    case 'community': return <Users className="w-4 h-4 text-orange-400" />
    case 'profile_view': return <Eye className="w-4 h-4 text-blue-400" />
    case 'profile_save': return <Bookmark className="w-4 h-4 text-purple-400" />
    case 'admin_broadcast': return <Shield className="w-4 h-4 text-yellow-400" />
    case 'screenshot': return <Camera className="w-4 h-4 text-red-400" />
    default: return <Bell className="w-4 h-4 text-muted-foreground" />
  }
}

// ============================================
// Main NotificationCenter Component
// ============================================

export function NotificationCenter({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [activeTab, setActiveTab] = useState<NotificationTab>('all')
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Fetch notifications
  const fetchNotifications = useCallback(async (append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams()
      params.set('limit', '30')
      if (append && cursor) params.set('cursor', cursor)
      if (activeTab === 'messages') params.set('type', 'message')
      else if (activeTab === 'community') params.set('type', 'community')
      // For 'other' tab: fetch all and filter client-side to show
      // profile_view, profile_save, screenshot, admin_broadcast types

      const res = await fetch(`/api/notifications/list?${params.toString()}`, { credentials: 'same-origin' })
      const data = await res.json()

      if (data.ok) {
        let items: NotificationItem[] = data.data || []
        // For "other" tab, filter to show only non-message, non-community types
        if (activeTab === 'other') {
          items = items.filter((n: NotificationItem) =>
            n.type !== 'message' && n.type !== 'community'
          )
        }
        if (append) {
          setNotifications((prev) => [...prev, ...items])
        } else {
          setNotifications(items)
        }
        setCursor(data.nextCursor || null)
        setHasMore(!!data.nextCursor)
        setUnreadCount(data.unreadCount || 0)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [activeTab, cursor])

  useEffect(() => {
    fetchNotifications()
  }, [activeTab])

  // Fetch settings
  useEffect(() => {
    fetch('/api/notifications/settings', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setSettings(d.data) })
      .catch(() => {})
  }, [])

  // Mark all as read
  const markAllRead = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
        setUnreadCount(0)
      }
    } catch {
      // silent
    }
  }, [])

  // Mark single as read
  const markRead = useCallback(async (id: string) => {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
        credentials: 'same-origin',
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // silent
    }
  }, [])

  // Update settings
  const updateSetting = useCallback(async (key: string, value: any) => {
    try {
      const res = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        setSettings(data.data)
        toast.success('Setting updated')
      }
    } catch {
      toast.error('Failed to update')
    }
  }, [])

  // Infinite scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    if (scrollHeight - scrollTop - clientHeight < 200 && hasMore && !loadingMore) {
      fetchNotifications(true)
    }
  }, [hasMore, loadingMore, fetchNotifications])

  // Tabs
  const tabs: { key: NotificationTab; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'All', icon: <Bell className="w-3.5 h-3.5" /> },
    { key: 'messages', label: 'Chat', icon: <MessageCircle className="w-3.5 h-3.5" /> },
    { key: 'community', label: 'Community', icon: <Users className="w-3.5 h-3.5" /> },
    { key: 'other', label: 'Other', icon: <Eye className="w-3.5 h-3.5" /> },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold flex-1">Notifications</h2>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs text-primary font-medium hover:underline mr-2"
          >
            Mark all read
          </button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings className={`h-5 w-5 ${showSettings ? 'text-primary' : ''}`} />
        </Button>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && settings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-b border-border bg-card shrink-0"
          >
            <div className="px-4 py-3 space-y-3">
              <h3 className="text-sm font-semibold text-primary">Notification Settings</h3>

              <div className="space-y-2.5">
                <SettingToggle
                  icon={<MessageCircle className="w-4 h-4" />}
                  label="New Messages"
                  description="When you receive a message"
                  value={settings.messages}
                  onChange={(v) => updateSetting('messages', v)}
                />
                <SettingToggle
                  icon={<Users className="w-4 h-4" />}
                  label="Community Activity"
                  description="Upvotes on your posts"
                  value={settings.community}
                  onChange={(v) => updateSetting('community', v)}
                />
                <SettingToggle
                  icon={<Eye className="w-4 h-4" />}
                  label="Profile Views"
                  description="When someone views your profile"
                  value={settings.profileViews}
                  onChange={(v) => updateSetting('profileViews', v)}
                />
                <SettingToggle
                  icon={<Bookmark className="w-4 h-4" />}
                  label="Profile Saves"
                  description="When someone saves your profile"
                  value={settings.profileSaves}
                  onChange={(v) => updateSetting('profileSaves', v)}
                />
              </div>

              {/* Quiet Hours */}
              <div className="pt-2 border-t border-border/30">
                <SettingToggle
                  icon={<VolumeX className="w-4 h-4" />}
                  label="Quiet Hours"
                  description="No notifications during set hours"
                  value={settings.quietHoursEnabled}
                  onChange={(v) => updateSetting('quietHoursEnabled', v)}
                />
                {settings.quietHoursEnabled && (
                  <div className="flex items-center gap-2 mt-2 pl-8">
                    <Input
                      type="time"
                      value={settings.quietHoursStart}
                      onChange={(e) => updateSetting('quietHoursStart', e.target.value)}
                      className="h-9 text-sm rounded-xl w-28"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={settings.quietHoursEnd}
                      onChange={(e) => updateSetting('quietHoursEnd', e.target.value)}
                      className="h-9 text-sm rounded-xl w-28"
                    />
                  </div>
                )}
              </div>

              {/* Admin broadcasts — always on, can't disable */}
              <div className="pt-2 border-t border-border/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-yellow-400" />
                    <div>
                      <p className="text-sm font-medium">Admin Alerts</p>
                      <p className="text-[10px] text-muted-foreground">Always on — cannot disable</p>
                    </div>
                  </div>
                  <Switch checked={true} disabled />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Bar */}
      <div className="flex items-center border-b border-border/50 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.key ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.key && (
              <motion.div
                layoutId="notif-tab-indicator"
                className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain gnect-scroll"
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-3 py-16">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Bell className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No notifications yet</h3>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              When you get activity, it&apos;ll show here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {notifications.map((notif) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.1 }}
                onClick={() => { if (!notif.is_read) markRead(notif.id) }}
                className={`px-4 py-3 flex gap-3 cursor-pointer active:bg-card/50 transition-colors ${
                  !notif.is_read ? 'bg-primary/5' : ''
                }`}
              >
                {/* Icon */}
                <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                  !notif.is_read ? 'bg-primary/10' : 'bg-secondary'
                }`}>
                  <NotificationIcon type={notif.type} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{notif.title}</span>
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notif.body}</p>
                  <span className="text-[10px] text-muted-foreground/50 mt-1 block">
                    {relativeTime(notif.created_at)}
                  </span>
                </div>
              </motion.div>
            ))}

            {loadingMore && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ============================================
// Setting Toggle Component
// ============================================

function SettingToggle({
  icon,
  label,
  description,
  value,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-[10px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  )
}
