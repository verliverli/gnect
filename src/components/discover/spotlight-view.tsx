'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Bookmark,
  BookmarkCheck,
  Lock,
  MessageCircle,
  MapPin,
  Clock,
  Shield,
  Calendar,
  Eye,
  Send,
  ChevronLeft,
  ChevronRight,
  XCircle,
  Flag,
  Ban,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { getMediaUrl } from '@/lib/constants'

// ============================================
// Types
// ============================================

interface SpotlightPhoto {
  id: string
  catbox_url: string
  is_face_pic: boolean
  is_locked: boolean
}

interface SpotlightProfile {
  id: string
  nickname: string
  age: number
  region: string
  bio: string
  height: number | null
  weight: number | null
  body_type: string
  role: string
  availability: string
  discretion_mode: boolean
  has_secret_phrase: boolean
  street: string | null
  cucumber_size: number | null
  show_cucumber: boolean
  status_text: string | null
  status_gradient: string | null
  is_online: boolean
  last_seen: string
  created_at: string
  photos: SpotlightPhoto[]
  into_tags: string[]
  is_saved: boolean
  is_blocked: boolean
}

interface SpotlightViewProps {
  userId: string
  currentUserId: string
  currentTags: string[]
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
  onOpenChat?: (userId: string) => void
}

// ============================================
// Relative time helper
// ============================================

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then

  if (diffMs < 0) return 'just now'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`

  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ============================================
// Spotlight View Component
// ============================================

export function SpotlightView({
  userId,
  currentUserId,
  currentTags,
  onClose,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  onOpenChat,
}: SpotlightViewProps) {
  const { user: currentUser } = useAuthStore()
  const [profile, setProfile] = useState<SpotlightProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [isSaved, setIsSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false)
  const [unlockPhotoId, setUnlockPhotoId] = useState<string | null>(null)
  const [unlockPhrase, setUnlockPhrase] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [unlockedPhotos, setUnlockedPhotos] = useState<Set<string>>(new Set())
  const [openSection, setOpenSection] = useState<'physical' | 'tags' | 'stats' | null>(null)
  const [discretionRevealed, setDiscretionRevealed] = useState(false)

  // Fetch profile data
  const fetchProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    setPhotoIndex(0)
    setUnlockedPhotos(new Set())
    setOpenSection(null)
    try {
      const res = await fetch(`/api/profile/${userId}`, { credentials: 'same-origin' })
      const data = await res.json()
      if (data.ok) {
        setProfile(data.data)
        setIsSaved(data.data.is_saved)
      } else {
        setError(data.error || 'Failed to load profile')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  // Save/bookmark toggle
  const toggleSave = async () => {
    if (saving || !profile) return
    setSaving(true)
    try {
      const method = isSaved ? 'DELETE' : 'POST'
      const res = await fetch('/api/profile/save', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        setIsSaved(!isSaved)
        toast.success(isSaved ? 'Removed from saved' : 'Profile saved!')
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  // Block user
  const handleBlock = async () => {
    if (!profile) return
    try {
      const res = await fetch('/api/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('User blocked')
        onClose()
      } else {
        toast.error(data.error || 'Failed to block')
      }
    } catch {
      toast.error('Network error')
    }
  }

  // Report user
  const handleReport = async (reason: string) => {
    if (!profile) return
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, reason }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Report submitted')
        onClose()
      } else {
        toast.error(data.error || 'Failed to report')
      }
    } catch {
      toast.error('Network error')
    }
  }

  // Unlock photo handler
  const handleUnlock = async () => {
    if (!unlockPhotoId || !unlockPhrase.trim()) return
    setUnlocking(true)
    try {
      const res = await fetch(`/api/profile/${userId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase: unlockPhrase.trim() }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok && data.unlocked) {
        setUnlockedPhotos((prev) => new Set(prev).add(unlockPhotoId))
        toast.success('Photo unlocked!')
        setUnlockDialogOpen(false)
        setUnlockPhrase('')
        setUnlockPhotoId(null)
      } else {
        toast.error(data.ok ? 'Wrong phrase' : (data.error || 'Failed to unlock'))
      }
    } catch {
      toast.error('Network error')
    } finally {
      setUnlocking(false)
    }
  }

  // Not interested — just go to next or close
  const handleNotInterested = () => {
    if (hasNext && onNext) {
      onNext()
    } else if (hasPrev && onPrev) {
      onPrev()
    } else {
      onClose()
    }
  }

  // Photo navigation
  const nextPhoto = () => {
    if (!profile) return
    setPhotoIndex((prev) => (prev + 1) % profile.photos.length)
  }
  const prevPhoto = () => {
    if (!profile) return
    setPhotoIndex((prev) => (prev - 1 + profile.photos.length) % profile.photos.length)
  }

  // Is new user (< 7 days)
  const isNew = profile
    ? Date.now() - new Date(profile.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
    : false

  // Proximity
  const proximity = (() => {
    if (!profile || !currentUser) return null
    if (profile.street && currentUser.street && profile.street === currentUser.street) {
      return 'Same street'
    }
    if (profile.region === currentUser.region) {
      return 'Same area'
    }
    return null
  })()

  // Availability pulse
  const isAvailableNow = profile?.availability === 'Available Now'

  // Gradient for status text
  const statusGradient = profile?.status_gradient || 'from-primary/20 to-primary/5'

  // Loading state
  if (loading) {
    return (
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-50 bg-background flex flex-col"
      >
        {/* Header skeleton */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-5 w-24" />
          <div className="flex-1" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        {/* Photo skeleton */}
        <Skeleton className="w-full aspect-[3/4]" />
        {/* Info skeleton */}
        <div className="px-4 -mt-6 relative z-10 space-y-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </motion.div>
    )
  }

  // Error state
  if (error || !profile) {
    return (
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-4 p-6"
      >
        <p className="text-muted-foreground text-center">{error || 'Profile not found'}</p>
        <Button variant="outline" size="lg" className="rounded-2xl h-12" onClick={onClose}>
          Go Back
        </Button>
      </motion.div>
    )
  }

  // Blocked state
  if (profile.is_blocked) {
    return (
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-4 p-6"
      >
        <Shield className="w-12 h-12 text-muted-foreground/50" />
        <p className="text-muted-foreground text-center">This profile is not available</p>
        <Button variant="outline" size="lg" className="rounded-2xl h-12" onClick={onClose}>
          Go Back
        </Button>
      </motion.div>
    )
  }

  const currentPhoto = profile.photos[photoIndex]

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* ===== HEADER BAR ===== */}
      <div className="flex items-center gap-2 px-3 py-2 bg-background/95 backdrop-blur-sm border-b border-border/50 shrink-0 z-20">
        {/* Close button */}
        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full flex items-center justify-center active:bg-secondary transition-colors shrink-0"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Nickname */}
        <h2 className="text-base font-bold flex-1 truncate">{profile.nickname}</h2>
      </div>

      {/* ===== SCROLLABLE CONTENT ===== */}
      <div className="flex-1 overflow-y-auto overscroll-contain gnect-scroll relative pb-48">
        {/* ===== PHOTO GALLERY ===== */}
        <div className="relative w-full aspect-[3/4] bg-secondary/30 overflow-hidden">
          {profile.photos.length > 0 ? (
            <>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${photoIndex}-${currentPhoto?.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0"
                >
                  {/* Check if photo should be blurred (discretion mode + face pic) */}
                  {currentPhoto.is_face_pic && profile.discretion_mode ? (
                    <div
                      className="relative w-full h-full cursor-pointer"
                      onTouchStart={() => setDiscretionRevealed(true)}
                      onTouchEnd={() => setDiscretionRevealed(false)}
                      onMouseDown={() => setDiscretionRevealed(true)}
                      onMouseUp={() => setDiscretionRevealed(false)}
                      onMouseLeave={() => setDiscretionRevealed(false)}
                    >
                      <img
                        src={getMediaUrl(currentPhoto.catbox_url) ?? undefined}
                        alt={`${profile.nickname}'s photo`}
                        className="w-full h-full object-cover transition-all duration-300"
                        style={{ filter: discretionRevealed ? 'blur(0px)' : 'blur(20px)' }}
                      />
                      {/* Discretion badge — hide when revealed */}
                      {!discretionRevealed && (
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-sm text-xs font-medium flex items-center gap-1">
                          <Eye className="w-3 h-3" /> Tap & hold to reveal
                        </div>
                      )}
                    </div>
                  ) : unlockedPhotos.has(currentPhoto.id) ? (
                    /* Unlocked photo — reveal it */
                    <img
                      src={getMediaUrl(currentPhoto.catbox_url) ?? undefined}
                      alt={`${profile.nickname}'s photo`}
                      className="w-full h-full object-cover"
                    />
                  ) : currentPhoto.is_locked ? (
                    /* Locked photo — blacked out */
                    <button
                      className="w-full h-full bg-black flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform"
                      onClick={() => {
                        setUnlockPhotoId(currentPhoto.id)
                        setUnlockDialogOpen(true)
                      }}
                    >
                      <Lock className="w-12 h-12 text-white/30" />
                      <span className="text-white/50 text-sm font-medium">Tap to unlock</span>
                    </button>
                  ) : (
                    /* Normal photo */
                    <img
                      src={getMediaUrl(currentPhoto.catbox_url) ?? undefined}
                      alt={`${profile.nickname}'s photo`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Photo navigation arrows — BIGGER */}
              {profile.photos.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={nextPhoto}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Dot indicators */}
              {profile.photos.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {profile.photos.map((photo, i) => (
                    <button
                      key={photo.id}
                      onClick={() => setPhotoIndex(i)}
                      className={`h-1.5 rounded-full transition-all duration-200 ${
                        i === photoIndex
                          ? 'w-5 bg-white'
                          : 'w-1.5 bg-white/40'
                      }`}
                      aria-label={`Photo ${i + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Discretion badge for non-face pics when discretion mode is on */}
              {profile.discretion_mode && !currentPhoto.is_face_pic && (
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-background/60 backdrop-blur-sm text-[10px] font-medium flex items-center gap-1 text-muted-foreground">
                  <Eye className="w-3 h-3" /> Discretion ON
                </div>
              )}
            </>
          ) : (
            /* No photos — placeholder with first letter */
            <div className="w-full h-full flex items-center justify-center bg-primary/5">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-primary/15 flex items-center justify-center border-2 border-primary/20">
                <span className="text-4xl sm:text-5xl font-bold text-primary/60">
                  {profile.nickname.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ===== PROFILE INFO CARD (overlapping photo) ===== */}
        <div className="relative -mt-8 z-10 rounded-t-3xl bg-background border-t border-border/50">
          <div className="px-4 pt-5 pb-4 space-y-3">
            {/* Nickname + Online indicator */}
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold truncate">{profile.nickname}</h1>
              {profile.is_online && (
                <span className="flex items-center gap-1 text-xs font-medium text-primary shrink-0">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                  </span>
                  Online
                </span>
              )}
            </div>

            {/* Role badge + Age + Region */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-primary/15 text-primary border-primary/20 font-medium">
                {profile.role}
              </Badge>
              <span className="text-sm text-muted-foreground">{profile.age} yrs</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span className="text-sm text-muted-foreground flex items-center gap-0.5">
                <MapPin className="w-3 h-3 text-primary/70" />{profile.region}
              </span>
              {isNew && (
                <>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                  <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20 text-[10px]">
                    New
                  </Badge>
                </>
              )}
            </div>

            {/* Proximity indicator */}
            {proximity && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 text-primary/70" />
                <span>{proximity}</span>
              </div>
            )}

            {/* Availability status */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  isAvailableNow
                    ? 'bg-emerald-500/15 text-emerald-500'
                    : profile.availability === 'Not Now'
                    ? 'bg-secondary text-muted-foreground'
                    : 'bg-primary/10 text-primary/70'
                }`}
              >
                {isAvailableNow && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
                {profile.availability}
              </span>
            </div>

            {/* Quick status strip */}
            {profile.status_text && (
              <div
                className={`px-3 py-2 rounded-xl bg-gradient-to-r ${statusGradient} border border-primary/10`}
              >
                <p className="text-sm text-foreground/90">{profile.status_text}</p>
              </div>
            )}

            {/* Bio */}
            {profile.bio && (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}
          </div>

          {/* ===== DETAILS SECTION ===== */}
          <div className="px-4 pb-6 space-y-2">
            {/* Physical Section */}
            <DetailSection
              icon="💪"
              label="Physical"
              summary={`${profile.body_type}${profile.height ? ' · ' + profile.height + 'cm' : ''}${profile.weight ? ' · ' + profile.weight + 'kg' : ''}`}
              isOpen={openSection === 'physical'}
              onToggle={() => setOpenSection(openSection === 'physical' ? null : 'physical')}
            >
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Body Type</span>
                  <span className="font-medium">{profile.body_type}</span>
                </div>
                {profile.height && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Height</span>
                    <span className="font-medium">{profile.height}cm</span>
                  </div>
                )}
                {profile.weight && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Weight</span>
                    <span className="font-medium">{profile.weight}kg</span>
                  </div>
                )}
                {profile.show_cucumber && profile.cucumber_size && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size</span>
                    <span className="font-medium">🥒 {profile.cucumber_size} in</span>
                  </div>
                )}
              </div>
            </DetailSection>

            {/* Into Tags Section */}
            {profile.into_tags.length > 0 && (
              <DetailSection
                icon="🏷️"
                label={`Into (${profile.into_tags.length})`}
                summary={profile.into_tags.slice(0, 3).join(', ')}
                isOpen={openSection === 'tags'}
                onToggle={() => setOpenSection(openSection === 'tags' ? null : 'tags')}
              >
                <div className="flex flex-wrap gap-1.5">
                  {profile.into_tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className={`text-xs ${
                        currentTags.includes(tag) ? 'bg-primary/15 text-primary border-primary/20' : ''
                      }`}
                    >
                      {currentTags.includes(tag) && '🔗 '}{tag}
                    </Badge>
                  ))}
                </div>
                {currentTags.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    🔗 = matches your interests
                  </p>
                )}
              </DetailSection>
            )}

            {/* Stats Section */}
            <DetailSection
              icon="📊"
              label="Stats"
              summary={`Last seen ${relativeTime(profile.last_seen)}`}
              isOpen={openSection === 'stats'}
              onToggle={() => setOpenSection(openSection === 'stats' ? null : 'stats')}
            >
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> Member since
                  </span>
                  <span className="font-medium">
                    {new Date(profile.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Last seen
                  </span>
                  <span className="font-medium">{relativeTime(profile.last_seen)}</span>
                </div>
              </div>
            </DetailSection>
          </div>
        </div>
      </div>

      {/* ===== BIG ACTION BAR (fixed bottom) ===== */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-background via-background/98 to-transparent pt-8 pb-4 px-4 space-y-3">
        {/* Row 1: Prev + Message + Next — BIG, attractive navigation */}
        <div className="flex gap-3 items-center">
          {/* Previous Profile — BIG round button */}
          {hasPrev ? (
            <button
              onClick={onPrev}
              className="h-14 w-14 rounded-full flex items-center justify-center bg-secondary hover:bg-secondary/80 text-secondary-foreground active:scale-90 transition-all shadow-sm"
              aria-label="Previous profile"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          ) : (
            <div className="h-14 w-14 rounded-full flex items-center justify-center bg-secondary/20 text-secondary-foreground/20">
              <ChevronLeft className="w-6 h-6" />
            </div>
          )}

          {/* Message — THE BIGGEST button */}
          <button
            className="flex-1 h-14 rounded-full flex items-center justify-center gap-2.5 font-bold text-base bg-primary text-primary-foreground shadow-lg active:scale-[0.96] transition-transform"
            onClick={() => {
              if (onOpenChat && profile) {
                onOpenChat(profile.id)
              }
            }}
          >
            <MessageCircle className="w-5 h-5" />
            Message
          </button>

          {/* Next Profile — BIG round button */}
          {hasNext ? (
            <button
              onClick={onNext}
              className="h-14 w-14 rounded-full flex items-center justify-center bg-secondary hover:bg-secondary/80 text-secondary-foreground active:scale-90 transition-all shadow-sm"
              aria-label="Next profile"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          ) : (
            <div className="h-14 w-14 rounded-full flex items-center justify-center bg-secondary/20 text-secondary-foreground/20">
              <ChevronRight className="w-6 h-6" />
            </div>
          )}
        </div>

        {/* Row 2: Save + Skip + Safety */}
        <div className="flex gap-2">
          {/* Save / Bookmark */}
          <button
            onClick={toggleSave}
            disabled={saving}
            className={`h-11 flex-1 rounded-full flex items-center justify-center gap-1.5 text-sm font-medium transition-all active:scale-95 ${
              isSaved
                ? 'bg-primary/15 text-primary border border-primary/20'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
            aria-label={isSaved ? 'Unsave profile' : 'Save profile'}
          >
            {isSaved ? (
              <BookmarkCheck className="w-4 h-4" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
            {isSaved ? 'Saved' : 'Save'}
          </button>

          {/* Not Interested */}
          <button
            onClick={handleNotInterested}
            className="h-11 flex-1 rounded-full flex items-center justify-center gap-1.5 text-sm font-medium bg-secondary text-secondary-foreground active:scale-95 transition-all"
          >
            <XCircle className="w-4 h-4" />
            Skip
          </button>

          {/* Safety dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-11 px-4 rounded-full flex items-center justify-center gap-1.5 text-sm font-medium bg-destructive/10 text-destructive active:scale-95 transition-all">
                <Shield className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive py-3"
                onClick={handleBlock}
              >
                <Ban className="w-4 h-4 mr-2" /> Block User
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive py-3"
                onClick={() => handleReport('Fake')}
              >
                <Flag className="w-4 h-4 mr-2" /> Report Fake
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive py-3"
                onClick={() => handleReport('Spam')}
              >
                <Flag className="w-4 h-4 mr-2" /> Report Spam
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive py-3"
                onClick={() => handleReport('Harassment')}
              >
                <Flag className="w-4 h-4 mr-2" /> Report Harassment
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive py-3"
                onClick={() => handleReport('Underage')}
              >
                <Flag className="w-4 h-4 mr-2" /> Report Underage
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ===== SECRET PHRASE DIALOG ===== */}
      <Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4" /> Unlock Photo
            </DialogTitle>
            <DialogDescription>
              Enter the secret phrase to reveal this locked photo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={unlockPhrase}
              onChange={(e) => setUnlockPhrase(e.target.value)}
              placeholder="Enter secret phrase..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUnlock()
              }}
              className="rounded-xl h-12"
              maxLength={50}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUnlockDialogOpen(false)
                setUnlockPhrase('')
                setUnlockPhotoId(null)
              }}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUnlock}
              disabled={!unlockPhrase.trim() || unlocking}
              className="rounded-xl gap-1.5"
            >
              {unlocking ? (
                <span className="animate-pulse">Unlocking...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Unlock
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ============================================
// Detail Section Component
// ============================================

function DetailSection({
  icon,
  label,
  summary,
  isOpen,
  onToggle,
  children,
}: {
  icon: React.ReactNode
  label: string
  summary: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-2xl border transition-colors ${
        isOpen ? 'border-primary/20 bg-card' : 'border-border bg-card'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left active:scale-[0.98] transition-transform"
      >
        <span className="text-base shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground truncate">{summary}</p>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-90' : ''
          }`}
        />
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
            <div className="px-4 pb-4 pt-0">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
