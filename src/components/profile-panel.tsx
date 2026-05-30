'use client'

import { X, Shield, Crown, Star, ChevronRight, LogOut, Camera, Eye, EyeOff, Trash2, Loader2, Clock, Zap, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useCallback, useEffect, useRef } from 'react'
import { ROLES, BODY_TYPES, INTO_TAGS, AVAILABILITY_STATUSES, MEDIA_LIMITS, getMediaUrl, STATUS_PRESETS, STATUS_DURATIONS, SAFE_PAGES } from '@/lib/constants'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { AdminBroadcastPanel } from '@/components/admin-broadcast-panel'
import { SafePagePicker } from '@/components/panic-button'
import { StealthIconToggle } from '@/components/stealth-icon-toggle'
import { SessionManager } from '@/components/session-manager'
import { PrivacyGuide } from '@/components/privacy-guide'

interface ProfilePanelProps {
  onClose: () => void
}

type Section = 'bio' | 'physical' | 'tags' | 'availability' | 'privacy' | 'status' | 'admin_broadcast' | 'account' | null

interface OwnPhoto {
  id: string
  catbox_url: string
  is_face_pic: boolean
  is_locked: boolean
  upload_order: number
}

export function ProfilePanel({ onClose }: ProfilePanelProps) {
  const { user, setUser, logout, disappearMode, setDisappearMode } = useAuthStore()
  const [openSection, setOpenSection] = useState<Section>(null)
  const [showPrivacyGuide, setShowPrivacyGuide] = useState(false)
  const [bio, setBio] = useState(user?.bio ?? '')
  const [heightVal, setHeightVal] = useState(user?.height?.toString() ?? '')
  const [weightVal, setWeightVal] = useState(user?.weight?.toString() ?? '')
  const [bodyType, setBodyType] = useState(user?.body_type ?? 'Average')
  const [role, setRole] = useState(user?.role ?? 'Versatile')
  const [tags, setTags] = useState<string[]>([])
  const [avail, setAvail] = useState(user?.availability ?? 'Not Now')
  const [discretion, setDiscretion] = useState(user?.discretion_mode ?? true)
  const [street, setStreet] = useState(user?.street ?? '')
  const [cucumberSize, setCucumberSize] = useState(user?.cucumber_size?.toString() ?? '')
  const [showCucumber, setShowCucumber] = useState(user?.show_cucumber ?? false)
  const [secret, setSecret] = useState(user?.secret_phrase ?? '')
  const [notToday, setNotToday] = useState(user?.not_today ?? false)
  const [statusText, setStatusText] = useState(user?.status_text ?? '')
  const [statusDuration, setStatusDuration] = useState('24h')
  const [saving, setSaving] = useState<string | null>(null)
  const [photos, setPhotos] = useState<OwnPhoto[]>([])
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null)
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Fetch tags and photos on mount
  useEffect(() => {
    fetch('/api/profile/tags', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setTags(d.data) })
      .catch(() => {})
    fetch('/api/profile/photos', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setPhotos(d.data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    return () => { timers.current.forEach((t) => clearTimeout(t)) }
  }, [])

  const refreshUser = useCallback(async () => {
    const me = await fetch('/api/auth/me', { credentials: 'same-origin' })
    const meData = await me.json()
    if (meData.ok && meData.user) setUser(meData.user)
  }, [setUser])

  const save = useCallback((key: string, endpoint: string, method: string, body: object) => {
    const existing = timers.current.get(key)
    if (existing) clearTimeout(existing)
    timers.current.set(key, setTimeout(async () => {
      setSaving(key)
      try {
        const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' })
        const data = await res.json()
        if (data.ok) {
          toast.success('Saved')
          await refreshUser()
        } else {
          toast.error(data.error || 'Save failed')
        }
      } catch {
        toast.error('Network error')
      } finally {
        setSaving(null)
      }
    }, 500))
  }, [refreshUser])

  const onBio = (v: string) => { if (v.length <= 300) { setBio(v); save('bio', '/api/profile/update', 'PUT', { bio: v }) } }
  const onHeight = (v: string) => { setHeightVal(v); const n = parseInt(v); if (!isNaN(n)) save('height', '/api/profile/update', 'PUT', { height: n }) }
  const onWeight = (v: string) => { setWeightVal(v); const n = parseInt(v); if (!isNaN(n)) save('weight', '/api/profile/update', 'PUT', { weight: n }) }
  const onBody = (v: string) => { setBodyType(v); save('body', '/api/profile/update', 'PUT', { body_type: v }) }
  const onRole = (v: string) => { setRole(v); save('role', '/api/profile/update-role', 'PUT', { role: v }) }
  const onTag = (tag: string) => {
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : tags.length < MEDIA_LIMITS.MAX_INTO_TAGS ? [...tags, tag] : tags
    setTags(next)
    save('tags', '/api/profile/update-tags', 'PUT', { tags: next })
  }
  const onAvail = (v: string) => { setAvail(v); save('avail', '/api/profile/update', 'PUT', { availability: v }) }
  const onDiscretion = (v: boolean) => { setDiscretion(v); save('discretion', '/api/profile/update', 'PUT', { discretion_mode: v }) }
  const onStreet = (v: string) => { if (v.length <= 30) { setStreet(v); save('street', '/api/profile/update', 'PUT', { street: v }) } }
  const onCucumberSize = (v: string) => { setCucumberSize(v); const n = parseInt(v); if (!isNaN(n) && n >= 1 && n <= 15) save('cucumber', '/api/profile/update', 'PUT', { cucumber_size: n }) }
  const onShowCucumber = (v: boolean) => { setShowCucumber(v); save('showcuc', '/api/profile/update', 'PUT', { show_cucumber: v }) }
  const onSecret = (v: string) => { setSecret(v); save('secret', '/api/profile/update', 'PUT', { secret_phrase: v }) }
  const onNotToday = (v: boolean) => { setNotToday(v); save('ntd', '/api/profile/not-today', 'POST', { activate: v }) }
  // Auto-assign gradient for status text
  const STATUS_GRADIENTS = [
    'linear-gradient(90deg, #059669, #10b981)',
    'linear-gradient(90deg, #7c3aed, #a78bfa)',
    'linear-gradient(90deg, #dc2626, #f87171)',
    'linear-gradient(90deg, #d97706, #fbbf24)',
    'linear-gradient(90deg, #0891b2, #22d3ee)',
    'linear-gradient(90deg, #be185d, #f472b6)',
    'linear-gradient(90deg, #4338ca, #818cf8)',
    'linear-gradient(90deg, #065f46, #34d399)',
  ]
  const onStatusText = (v: string) => {
    if (v.length <= 100) {
      setStatusText(v)
      save('status', '/api/profile/update-status', 'POST', { status_text: v || null, duration: statusDuration })
    }
  }
  const onLogout = async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); logout(); onClose() }

  const onPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPEG, PNG, and WebP images allowed')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Photo must be under 2MB')
      return
    }

    const isPremium = user?.is_premium || user?.is_premium_free || user?.is_early_adopter
    const maxPhotos = isPremium ? MEDIA_LIMITS.MAX_PREMIUM_PROFILE_PHOTOS : MEDIA_LIMITS.MAX_FREE_PROFILE_PHOTOS
    if (photos.length >= maxPhotos) {
      toast.error(`Photo limit reached (${maxPhotos} for ${isPremium ? 'premium' : 'free'} users)`)
      return
    }

    const formData = new FormData()
    formData.append('photo', file)

    try {
      setSaving('photo')
      const res = await fetch('/api/profile/upload-photo', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Photo uploaded!')
        // Refresh photos list
        const photosRes = await fetch('/api/profile/photos', { credentials: 'same-origin' })
        const photosData = await photosRes.json()
        if (photosData.ok) setPhotos(photosData.data)
      } else {
        toast.error(data.error || 'Upload failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(null)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  const onDeletePhoto = async (photoId: string) => {
    if (deletingPhotoId) return
    setDeletingPhotoId(photoId)
    try {
      const res = await fetch('/api/profile/delete-photo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Photo deleted')
        setPhotos((prev) => prev.filter((p) => p.id !== photoId))
      } else {
        toast.error(data.error || 'Delete failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setDeletingPhotoId(null)
    }
  }

  const isAdmin = user?.is_admin
  const initial = user?.nickname?.charAt(0)?.toUpperCase() || '?'
  const since = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''
  const isPremium = user?.is_premium || user?.is_premium_free || user?.is_early_adopter
  const maxPhotos = isPremium ? MEDIA_LIMITS.MAX_PREMIUM_PROFILE_PHOTOS : MEDIA_LIMITS.MAX_FREE_PROFILE_PHOTOS

  const toggleSection = (s: Section) => setOpenSection(openSection === s ? null : s)

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
        <h2 className="text-lg font-semibold flex-1">Profile</h2>
        {saving && (
          <span className="text-xs text-primary animate-pulse">Saving...</span>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain gnect-scroll">
        {/* Profile Card */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex flex-col items-center text-center">
            {/* Avatar */}
            <div className="relative mb-3">
              <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center border-2 border-primary/30">
                <span className="text-2xl font-bold text-primary">{initial}</span>
              </div>
              {isAdmin && (
                <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center border-2 border-background">
                  <Shield className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            {/* Name */}
            <h3 className="text-xl font-bold truncate max-w-full">{user?.nickname}</h3>

            {/* Badges row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap justify-center">
              {isAdmin ? (
                <>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/30">
                    <Shield className="w-3 h-3" /> BOSS
                  </span>
                  {user?.is_early_adopter && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/15 text-yellow-500 border border-yellow-500/20">
                      <Star className="w-3 h-3" /> Early
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                    {role}
                  </span>
                  {user?.is_early_adopter && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/15 text-yellow-500 border border-yellow-500/20">
                      <Star className="w-3 h-3" /> Early
                    </span>
                  )}
                  {(user?.is_premium || user?.is_premium_free) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20">
                      <Crown className="w-3 h-3" /> Premium
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Quick info */}
            {isAdmin ? (
              <p className="mt-2 text-xs text-muted-foreground">Since {since}</p>
            ) : (
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>{user?.age} yrs</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                <span>{user?.region}</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                <span>Since {since}</span>
              </div>
            )}

            {/* Admin message */}
            {isAdmin && (
              <div className="mt-3 px-4 py-2 rounded-xl bg-primary/5 border border-primary/10 text-xs text-primary/80 text-center">
                Boss mode — you run this app
              </div>
            )}
          </div>
        </div>

        {/* Photo Grid — only for regular users */}
        {!isAdmin && (
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Photos {photos.length}/{maxPhotos}
              </span>
              {saving === 'photo' && (
                <span className="text-xs text-primary animate-pulse">Uploading...</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {/* Existing photos */}
              {photos.map((photo) => (
                <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden bg-secondary group">
                  <img
                    src={getMediaUrl(photo.catbox_url) ?? undefined}
                    alt="Your photo"
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay on hover/tap */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => onDeletePhoto(photo.id)}
                      disabled={!!deletingPhotoId}
                      className="h-10 w-10 rounded-full bg-destructive/90 flex items-center justify-center active:scale-90 transition-transform"
                      aria-label="Delete photo"
                    >
                      {deletingPhotoId === photo.id ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <Trash2 className="w-5 h-5 text-white" />
                      )}
                    </button>
                  </div>
                  {/* Face pic badge */}
                  {photo.is_face_pic && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-background/80 text-[9px] font-medium text-foreground backdrop-blur-sm">
                      Face
                    </span>
                  )}
                  {/* Locked badge */}
                  {photo.is_locked && (
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-primary/80 text-[9px] font-medium text-primary-foreground backdrop-blur-sm">
                      Locked
                    </span>
                  )}
                </div>
              ))}
              {/* Add photo button (only if under limit) */}
              {photos.length < maxPhotos && (
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="aspect-square rounded-xl bg-secondary/50 border border-dashed border-border flex items-center justify-center hover:bg-secondary active:scale-95 transition-all"
                  aria-label="Add photo"
                >
                  <Camera className="w-6 h-6 text-muted-foreground/50" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sections */}
        <div className="px-4 space-y-2 pb-8">
          {/* Bio — only for regular users */}
          {!isAdmin && (
            <SectionCard
              icon="✏️"
              label="Bio"
              value={bio ? (bio.length > 40 ? bio.slice(0, 40) + '...' : bio) : 'Tap to add'}
              isOpen={openSection === 'bio'}
              onToggle={() => toggleSection('bio')}
            >
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-muted-foreground">About you</span>
                  <span className="text-xs text-muted-foreground">{bio.length}/300</span>
                </div>
                <textarea
                  value={bio}
                  onChange={(e) => onBio(e.target.value)}
                  className="w-full bg-secondary/50 rounded-xl p-3 text-sm resize-none border border-border focus:border-primary/40 focus:outline-none transition-colors"
                  rows={3}
                  placeholder="Tell others about yourself..."
                />
              </div>
            </SectionCard>
          )}

          {/* Status — only for regular users */}
          {!isAdmin && (
            <SectionCard
              icon="💬"
              label="Status"
              value={statusText || 'Tap to add'}
              isOpen={openSection === 'status'}
              onToggle={() => toggleSection('status')}
            >
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Quick status line</span>
                    <span className="text-xs text-muted-foreground">{statusText.length}/100</span>
                  </div>
                  <Input
                    value={statusText}
                    onChange={(e) => onStatusText(e.target.value)}
                    className="text-sm h-10 rounded-xl"
                    placeholder="e.g. Looking for fun tonight 🔥"
                    maxLength={100}
                  />
                </div>

                {/* Duration selector */}
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-0.5 block mb-1.5">
                    Auto-delete after
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_DURATIONS.map((d) => (
                      <button
                        key={d.value}
                        onClick={() => {
                          setStatusDuration(d.value)
                          if (statusText) {
                            save('status', '/api/profile/update-status', 'POST', { status_text: statusText, duration: d.value })
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-full text-[10px] font-medium transition-all ${
                          statusDuration === d.value
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        }`}
                      >
                        <Clock className="w-3 h-3 inline mr-0.5" />
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick presets */}
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-0.5 block mb-1.5">
                    <Zap className="w-3 h-3 inline mr-0.5" />
                    Quick presets
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_PRESETS.map((preset) => (
                      <button
                        key={preset.text}
                        onClick={() => {
                          setStatusText(preset.text)
                          setStatusDuration(preset.duration)
                          save('status', '/api/profile/update-status', 'POST', { status_text: preset.text, duration: preset.duration })
                        }}
                        className="px-2.5 py-1.5 rounded-full text-[10px] font-medium bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary transition-all"
                      >
                        {preset.text.length > 25 ? preset.text.slice(0, 24) + '…' : preset.text}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status views counter */}
                {statusText && (user?.status_views ?? 0) > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Eye className="w-3 h-3" />
                    {user?.status_views} {user?.status_views === 1 ? 'view' : 'views'}
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Physical — only for regular users */}
          {!isAdmin && (
            <SectionCard
              icon="💪"
              label="Physical"
              value={`${role} · ${bodyType}${heightVal ? ' · ' + heightVal + 'cm' : ''}${weightVal ? ' · ' + weightVal + 'kg' : ''}`}
              isOpen={openSection === 'physical'}
              onToggle={() => toggleSection('physical')}
            >
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-muted-foreground mb-2 block">Role</span>
                  <div className="flex flex-wrap gap-2">
                    {ROLES.map((r) => (
                      <button key={r} onClick={() => onRole(r)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${r === role ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground mb-2 block">Body Type</span>
                  <div className="flex flex-wrap gap-2">
                    {BODY_TYPES.map((bt) => (
                      <button key={bt} onClick={() => onBody(bt)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${bt === bodyType ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
                        {bt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground mb-1 block">Height (cm)</span>
                    <Input type="number" value={heightVal} onChange={(e) => onHeight(e.target.value)} className="text-sm h-10 rounded-xl" placeholder="170" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground mb-1 block">Weight (kg)</span>
                    <Input type="number" value={weightVal} onChange={(e) => onWeight(e.target.value)} className="text-sm h-10 rounded-xl" placeholder="70" />
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">Street (optional)</span>
                  <Input type="text" value={street} onChange={(e) => onStreet(e.target.value)} className="text-sm h-10 rounded-xl" placeholder="e.g. Kariakoo Street" maxLength={30} />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">Size (inches, optional)</span>
                  <Input type="number" value={cucumberSize} onChange={(e) => onCucumberSize(e.target.value)} className="text-sm h-10 rounded-xl" placeholder="1-15" min={1} max={15} />
                </div>
              </div>
            </SectionCard>
          )}

          {/* Tags — only for regular users */}
          {!isAdmin && (
            <SectionCard
              icon="🏷️"
              label={`Into Tags (${tags.length}/${MEDIA_LIMITS.MAX_INTO_TAGS})`}
              value={tags.length > 0 ? tags.slice(0, 3).join(', ') + (tags.length > 3 ? '...' : '') : 'Tap to choose'}
              isOpen={openSection === 'tags'}
              onToggle={() => toggleSection('tags')}
            >
              <div className="flex flex-wrap gap-2">
                {INTO_TAGS.map((tag) => (
                  <button key={tag} onClick={() => onTag(tag)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${tags.includes(tag) ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
                    {tag}
                  </button>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Availability — only for regular users */}
          {!isAdmin && (
            <SectionCard
              icon="📍"
              label="Availability"
              value={avail}
              isOpen={openSection === 'availability'}
              onToggle={() => toggleSection('availability')}
            >
              <div className="flex flex-wrap gap-2">
                {AVAILABILITY_STATUSES.map((s) => (
                  <button key={s} onClick={() => onAvail(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${s === avail ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Privacy */}
          <SectionCard
            icon={discretion ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            label="Privacy"
            value={discretion ? 'Discretion ON' : 'Discretion OFF'}
            isOpen={openSection === 'privacy'}
            onToggle={() => toggleSection('privacy')}
          >
            <div className="space-y-4">
              {/* Privacy Guide Help Button */}
              <button
                onClick={() => setShowPrivacyGuide(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors active:scale-[0.98]"
              >
                <HelpCircle className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-primary">How to use privacy features</p>
                  <p className="text-xs text-muted-foreground">Tap here for the full safety guide</p>
                </div>
                <ChevronRight className="w-4 h-4 text-primary/50 shrink-0" />
              </button>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Discretion Mode</p>
                  <p className="text-xs text-muted-foreground">Blur face photos by default</p>
                </div>
                <Switch checked={discretion} onCheckedChange={onDiscretion} />
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Secret Phrase</p>
                <p className="text-xs text-muted-foreground mb-2">Others must type this to see locked photos</p>
                <Input value={secret ?? ''} onChange={(e) => onSecret(e.target.value)} className="text-sm h-10 rounded-xl" placeholder="Enter a secret phrase..." maxLength={50} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Show Size</p>
                  <p className="text-xs text-muted-foreground">Let others see your size on profile</p>
                </div>
                <Switch checked={showCucumber} onCheckedChange={onShowCucumber} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Not Today</p>
                  <p className="text-xs text-muted-foreground">Hide your profile for 24 hours</p>
                </div>
                <Switch checked={notToday} onCheckedChange={onNotToday} />
              </div>

              {/* Phase 6: Disappear Mode */}
              <div className="pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Disappear Mode</p>
                    <p className="text-xs text-muted-foreground">Hide chat content in chat list</p>
                  </div>
                  <Switch checked={disappearMode} onCheckedChange={setDisappearMode} />
                </div>
              </div>

              {/* Phase 6: Panic Button Safe Page */}
              <div className="pt-3 border-t border-border/50">
                <SafePagePicker
                  value={(() => {
                    try {
                      const s = user?.notification_settings ? JSON.parse(user.notification_settings) : {}
                      return s.safePageId || 'calculator'
                    } catch { return 'calculator' }
                  })()}
                  onChange={async (id) => {
                    try {
                      const settings = user?.notification_settings ? JSON.parse(user.notification_settings) : {}
                      settings.safePageId = id
                      await fetch('/api/notifications/settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ settings }),
                        credentials: 'same-origin',
                      })
                      toast.success('Safe page updated')
                      await refreshUser()
                    } catch {
                      toast.error('Failed to save')
                    }
                  }}
                />
              </div>

              {/* Phase 6: Stealth App Icon */}
              <div className="pt-3 border-t border-border/50">
                <StealthIconToggle />
              </div>

              {/* Phase 6: Discreet Notifications */}
              <div className="pt-3 border-t border-border/50">
                <p className="text-sm font-medium">Discreet Notifications</p>
                <p className="text-xs text-muted-foreground mb-2">Disguise push notification content</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'default', label: '🔔 New activity' },
                    { id: 'weather', label: '🌤️ Weather update' },
                    { id: 'news', label: '📰 News alert' },
                    { id: 'delivery', label: '📦 Delivery update' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={async () => {
                        try {
                          const settings = user?.notification_settings ? JSON.parse(user.notification_settings) : {}
                          settings.discreetNotifStyle = style.id
                          await fetch('/api/notifications/settings', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ settings }),
                            credentials: 'same-origin',
                          })
                          toast.success('Notification style updated')
                          await refreshUser()
                        } catch {
                          toast.error('Failed to save')
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        (() => {
                          try {
                            const s = user?.notification_settings ? JSON.parse(user.notification_settings) : {}
                            return (s.discreetNotifStyle || 'default') === style.id
                          } catch { return style.id === 'default' }
                        })()
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Admin Broadcast Panel — only for admins */}
          {isAdmin && (
            <SectionCard
              icon={<Shield className="w-4 h-4" />}
              label="BOSS MODE"
              value="Send broadcasts to all users"
              isOpen={openSection === 'admin_broadcast'}
              onToggle={() => toggleSection('admin_broadcast')}
            >
              <AdminBroadcastPanel />
            </SectionCard>
          )}

          {/* Account */}
          <SectionCard
            icon={<LogOut className="w-4 h-4" />}
            label="Account"
            value={`Member since ${since}`}
            isOpen={openSection === 'account'}
            onToggle={() => toggleSection('account')}
          >
            <div className="space-y-4">
              {/* Phase 6: Session Manager */}
              <SessionManager />

              <div className="pt-2 border-t border-border/50">
                <Button variant="destructive" className="w-full rounded-xl h-11" onClick={onLogout}>
                  <LogOut className="w-4 h-4 mr-2" /> Logout
                </Button>
              </div>
              <Button variant="ghost" className="w-full text-muted-foreground text-xs rounded-xl" onClick={() => toast('Coming soon')}>
                <Trash2 className="w-3 h-3 mr-1" /> Delete Account
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
      {/* Hidden file input for photo upload */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onPhotoUpload}
      />

      {/* Privacy Guide overlay */}
      <AnimatePresence>
        {showPrivacyGuide && <PrivacyGuide onClose={() => setShowPrivacyGuide(false)} />}
      </AnimatePresence>
    </motion.div>
  )
}

// Expandable section card component
function SectionCard({
  icon,
  label,
  value,
  isOpen,
  onToggle,
  children,
}: {
  icon: React.ReactNode
  label: string
  value: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-2xl border transition-colors ${isOpen ? 'border-primary/20 bg-card' : 'border-border bg-card hover:bg-card/80'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left min-h-[52px]"
      >
        <span className="text-base shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground truncate">{value}</p>
        </div>
        <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
