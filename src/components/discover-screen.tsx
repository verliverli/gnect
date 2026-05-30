'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Compass, Search, RefreshCw, Users, MapPin, Loader2, RotateCcw, ChevronDown, Shield } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { BannerCard } from '@/components/discover/banner-card'
import { SpotlightView } from '@/components/discover/spotlight-view'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ROLES, BODY_TYPES, AVAILABILITY_STATUSES } from '@/lib/constants'

// ============================================
// Types
// ============================================

type DiscoverTab = 'nearby' | 'all'

interface DiscoverUser {
  id: string
  nickname: string
  age: number
  region: string
  role: string
  body_type: string
  availability: string
  is_online: boolean
  last_seen: string
  street?: string | null
  cucumber_size?: number | null
  show_cucumber?: boolean
  discretion_mode: boolean
  status_text?: string | null
  status_gradient?: string | null
  created_at: string
  photos: { id: string; catbox_url: string; is_face_pic: boolean; is_locked: boolean }[]
  into_tags: string[]
  is_saved: boolean
}

interface NearbyFilters {
  role: string
  availability: string
  bodyType: string
  street: string
}

const DEFAULT_NEARBY_FILTERS: NearbyFilters = {
  role: '',
  availability: '',
  bodyType: '',
  street: '',
}

// ============================================
// Simple Dropdown Select Component
// ============================================

function DropdownFilter({
  label,
  value,
  onChange,
  options,
  placeholder = 'All',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const displayValue = value || placeholder

  return (
    <div className="relative space-y-1" ref={ref}>
      <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-0.5">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full h-10 px-3 rounded-xl border text-sm text-left flex items-center justify-between gap-2 transition-colors ${
          value
            ? 'border-primary/30 bg-primary/5 text-primary font-medium'
            : 'border-border bg-card text-foreground hover:bg-card/80'
        }`}
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute left-0 right-0 z-30 mt-1 min-w-[160px] max-h-60 overflow-y-auto rounded-xl border bg-popover shadow-lg gnect-scroll"
          >
            {/* "All" option to clear */}
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className={`w-full px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors ${
                !value ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
              }`}
            >
              All
            </button>
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt === value ? '' : opt); setOpen(false) }}
                className={`w-full px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors ${
                  opt === value ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
                }`}
              >
                {opt}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================
// Discover Screen Component
// ============================================

export function DiscoverScreen({ onOpenChat }: { onOpenChat?: (userId: string) => void }) {
  const { user: currentUser } = useAuthStore()

  // Tab state
  const [activeTab, setActiveTab] = useState<DiscoverTab>('nearby')

  // Nearby state
  const [nearbyUsers, setNearbyUsers] = useState<DiscoverUser[]>([])
  const [nearbyLoading, setNearbyLoading] = useState(true)
  const [nearbyCursor, setNearbyCursor] = useState<string | null>(null)
  const [nearbyHasMore, setNearbyHasMore] = useState(false)
  const [nearbyRefreshing, setNearbyRefreshing] = useState(false)
  const [nearbyLoadingMore, setNearbyLoadingMore] = useState(false)

  // All users state
  const [allUsers, setAllUsers] = useState<DiscoverUser[]>([])
  const [allLoading, setAllLoading] = useState(true)
  const [allCursor, setAllCursor] = useState<string | null>(null)
  const [allHasMore, setAllHasMore] = useState(false)
  const [allLoadingMore, setAllLoadingMore] = useState(false)
  const [allSearch, setAllSearch] = useState('')
  const [allAvailableOnly, setAllAvailableOnly] = useState(false)

  // Filter state for Nearby
  const [filters, setFilters] = useState<NearbyFilters>(DEFAULT_NEARBY_FILTERS)

  // Spotlight state
  const [spotlightUserId, setSpotlightUserId] = useState<string | null>(null)
  const [spotlightIndex, setSpotlightIndex] = useState(-1)

  // Pull-to-refresh state
  const [pullStartY, setPullStartY] = useState<number | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Current user's tags for shared interest matching
  const [currentTags, setCurrentTags] = useState<string[]>([])

  // Broadcast banner state
  const [activeBroadcasts, setActiveBroadcasts] = useState<any[]>([])

  // Fetch active broadcasts
  useEffect(() => {
    if (!currentUser) return
    const fetchBroadcasts = () => {
      fetch('/api/broadcasts/active', { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            // Show ALL active broadcasts (urgent + info) as uncancellable banners
            setActiveBroadcasts([...(d.urgent || []), ...(d.info || [])])
          }
        })
        .catch(() => {})
    }
    fetchBroadcasts()
    const interval = setInterval(fetchBroadcasts, 15000) // Check every 15s for real-time feel
    return () => clearInterval(interval)
  }, [currentUser])

  // Active filter count for badge
  const activeFilterCount =
    (filters.role ? 1 : 0) +
    (filters.availability ? 1 : 0) +
    (filters.bodyType ? 1 : 0) +
    (filters.street.trim() ? 1 : 0)

  // Fetch current user's tags on mount
  useEffect(() => {
    if (currentUser) {
      fetch('/api/profile/tags', { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((d) => { if (d.ok) setCurrentTags(d.data) })
        .catch(() => {})
    }
  }, [currentUser])

  // ========================================
  // Build query params from filters
  // ========================================
  const buildNearbyParams = useCallback((cursor?: string) => {
    const params = new URLSearchParams()
    params.set('limit', '20')
    if (cursor) params.set('cursor', cursor)

    // Sort based on availability filter
    if (filters.availability === 'Available Now') params.set('sort', 'available_now')
    else if (filters.availability === 'Online') params.set('sort', 'online')
    else if (filters.availability === 'New') params.set('sort', 'newest')
    else params.set('sort', 'nearby')

    // Role filter
    if (filters.role) params.set('role', filters.role)

    // Body type
    if (filters.bodyType) params.set('bodyType', filters.bodyType)

    // Availability
    if (filters.availability === 'Available Now') params.set('availability', 'Available Now')
    if (filters.availability === 'Tonight') params.set('availability', 'Tonight')
    if (filters.availability === 'This Week') params.set('availability', 'This Week')

    // Online only
    if (filters.availability === 'Online') params.set('onlineOnly', 'true')

    // Street
    if (filters.street.trim()) params.set('street', filters.street.trim())

    return params
  }, [filters])

  // ========================================
  // Fetch nearby users
  // ========================================
  const fetchNearby = useCallback(async (cursor?: string, append = false) => {
    if (!currentUser) return

    const isRefresh = !append && !cursor
    if (isRefresh) setNearbyRefreshing(true)
    else if (append) setNearbyLoadingMore(true)
    else setNearbyLoading(true)

    try {
      const params = buildNearbyParams(cursor)
      const res = await fetch(`/api/discover/nearby?${params.toString()}`, { credentials: 'same-origin' })
      const data = await res.json()

      if (data.ok) {
        const users = data.data || []
        if (append) {
          setNearbyUsers((prev) => [...prev, ...users])
        } else {
          setNearbyUsers(users)
        }
        setNearbyCursor(data.nextCursor || null)
        setNearbyHasMore(!!data.nextCursor)
      } else {
        if (!append) setNearbyUsers([])
        toast.error(data.error || 'Failed to load nearby users')
      }
    } catch {
      if (!append) setNearbyUsers([])
      toast.error('Network error')
    } finally {
      setNearbyLoading(false)
      setNearbyRefreshing(false)
      setNearbyLoadingMore(false)
    }
  }, [currentUser, buildNearbyParams])

  // ========================================
  // Fetch all users
  // ========================================
  const fetchAll = useCallback(async (cursor?: string, append = false) => {
    if (!currentUser) return

    const isRefresh = !append && !cursor
    if (isRefresh) setAllLoading(true)
    else if (append) setAllLoadingMore(true)

    try {
      const params = new URLSearchParams()
      params.set('limit', '20')
      if (cursor) params.set('cursor', cursor)
      if (allSearch.trim()) params.set('search', allSearch.trim().slice(0, 20))
      if (allAvailableOnly) params.set('availability', 'Available Now')

      const res = await fetch(`/api/discover/all?${params.toString()}`, { credentials: 'same-origin' })
      const data = await res.json()

      if (data.ok) {
        const users = data.data || []
        if (append) {
          setAllUsers((prev) => [...prev, ...users])
        } else {
          setAllUsers(users)
        }
        setAllCursor(data.nextCursor || null)
        setAllHasMore(!!data.nextCursor)
      } else {
        if (!append) setAllUsers([])
      }
    } catch {
      if (!append) setAllUsers([])
    } finally {
      setAllLoading(false)
      setAllLoadingMore(false)
    }
  }, [currentUser, allSearch, allAvailableOnly])

  // ========================================
  // Initial fetch & filter changes
  // ========================================
  useEffect(() => {
    if (currentUser) {
      setNearbyCursor(null)
      fetchNearby()
    }
  }, [currentUser, filters])

  useEffect(() => {
    if (activeTab === 'all' && currentUser) {
      setAllCursor(null)
      fetchAll()
    }
  }, [activeTab, currentUser, allSearch, allAvailableOnly])

  // ========================================
  // Save/bookmark toggle
  // ========================================
  const handleSave = useCallback(async (userId: string) => {
    try {
      const isInNearby = nearbyUsers.find((u) => u.id === userId)
      const isInAll = allUsers.find((u) => u.id === userId)
      const isSaved = isInNearby?.is_saved || isInAll?.is_saved || false

      const method = isSaved ? 'DELETE' : 'POST'
      const res = await fetch('/api/profile/save', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(isSaved ? 'Removed from saved' : 'Profile saved!')
        setNearbyUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, is_saved: !isSaved } : u))
        )
        setAllUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, is_saved: !isSaved } : u))
        )
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    }
  }, [nearbyUsers, allUsers])

  // ========================================
  // Spotlight navigation
  // ========================================
  const openSpotlight = useCallback((userId: string) => {
    const currentList = activeTab === 'nearby' ? nearbyUsers : allUsers
    const idx = currentList.findIndex((u) => u.id === userId)
    setSpotlightIndex(idx)
    setSpotlightUserId(userId)
  }, [activeTab, nearbyUsers, allUsers])

  const closeSpotlight = useCallback(() => {
    setSpotlightUserId(null)
    setSpotlightIndex(-1)
  }, [])

  const goToPrev = useCallback(() => {
    const currentList = activeTab === 'nearby' ? nearbyUsers : allUsers
    const newIdx = Math.max(0, spotlightIndex - 1)
    if (newIdx !== spotlightIndex) {
      setSpotlightIndex(newIdx)
      setSpotlightUserId(currentList[newIdx].id)
    }
  }, [activeTab, nearbyUsers, allUsers, spotlightIndex])

  const goToNext = useCallback(() => {
    const currentList = activeTab === 'nearby' ? nearbyUsers : allUsers
    const newIdx = Math.min(currentList.length - 1, spotlightIndex + 1)
    if (newIdx !== spotlightIndex) {
      setSpotlightIndex(newIdx)
      setSpotlightUserId(currentList[newIdx].id)
    }
  }, [activeTab, nearbyUsers, allUsers, spotlightIndex])

  // ========================================
  // Infinite scroll
  // ========================================
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    if (scrollHeight - scrollTop - clientHeight < 200) {
      if (activeTab === 'nearby' && nearbyHasMore && !nearbyLoadingMore && !nearbyLoading && !nearbyRefreshing) {
        fetchNearby(nearbyCursor || undefined, true)
      } else if (activeTab === 'all' && allHasMore && !allLoadingMore && !allLoading) {
        fetchAll(allCursor || undefined, true)
      }
    }
  }, [activeTab, nearbyHasMore, nearbyLoadingMore, nearbyLoading, nearbyRefreshing, nearbyCursor, fetchNearby, allHasMore, allLoadingMore, allLoading, allCursor, fetchAll])

  // ========================================
  // Pull-to-refresh
  // ========================================
  const onTouchStart = (e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop === 0) {
      setPullStartY(e.touches[0].clientY)
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (pullStartY === null) return
    const diff = e.touches[0].clientY - pullStartY
    if (diff > 0 && scrollRef.current && scrollRef.current.scrollTop === 0) {
      setPullDistance(Math.min(diff * 0.5, 80))
    }
  }

  const onTouchEnd = () => {
    if (pullDistance > 50) {
      if (activeTab === 'nearby') {
        setNearbyCursor(null)
        fetchNearby()
      } else {
        setAllCursor(null)
        fetchAll()
      }
    }
    setPullStartY(null)
    setPullDistance(0)
  }

  // ========================================
  // Search debounce for All Users
  // ========================================
  const handleSearchChange = (value: string) => {
    if (value.length > 20) return
    setAllSearch(value)
  }

  // ========================================
  // Reset filters
  // ========================================
  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_NEARBY_FILTERS)
  }, [])

  // ========================================
  // Loading skeleton
  // ========================================
  const renderSkeletons = () => (
    <div className="px-4 space-y-2.5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border bg-card p-3">
          <div className="flex items-start gap-3">
            <Skeleton className="w-20 h-20 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-36" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  // ========================================
  // Empty states
  // ========================================
  const renderEmpty = (type: 'nearby' | 'all' | 'filtered') => {
    const messages = {
      nearby: {
        title: 'No one nearby right now',
        subtitle: "They'll come 👀",
      },
      all: {
        title: 'No users yet',
        subtitle: 'Be the first in your area 🔥',
      },
      filtered: {
        title: 'No matches',
        subtitle: `No one matches your filters in ${currentUser?.region || 'your area'}. Try broadening.`,
      },
    }
    const msg = messages[type]
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-3 py-12">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Compass className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-base font-semibold text-foreground">{msg.title}</h3>
        <p className="text-xs text-muted-foreground text-center max-w-xs">{msg.subtitle}</p>
      </div>
    )
  }

  // ========================================
  // Render
  // ========================================
  return (
    <div className="h-full flex flex-col">
      {/* Tab Bar */}
      <div className="flex items-center border-b border-border/50 shrink-0">
        <button
          onClick={() => setActiveTab('nearby')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'nearby' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Nearby
          {activeTab === 'nearby' && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'all' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          All Users
          {activeTab === 'all' && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </button>
      </div>

      {/* ===== NEARBY FILTER DROPDOWNS ===== */}
      {activeTab === 'nearby' && (
        <div className="shrink-0 border-b border-border/30 bg-background/95 px-3 py-2.5">
          {/* Row 1: Role + Availability */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <DropdownFilter
              label="Role"
              value={filters.role}
              onChange={(v) => setFilters((prev) => ({ ...prev, role: v }))}
              options={ROLES}
              placeholder="All Roles"
            />
            <DropdownFilter
              label="Availability"
              value={filters.availability}
              onChange={(v) => setFilters((prev) => ({ ...prev, availability: v }))}
              options={['Available Now', 'Online', 'Tonight', 'This Week', 'New']}
              placeholder="All Status"
            />
          </div>

          {/* Row 2: Body Type + Street */}
          <div className="grid grid-cols-2 gap-2">
            <DropdownFilter
              label="Body Type"
              value={filters.bodyType}
              onChange={(v) => setFilters((prev) => ({ ...prev, bodyType: v }))}
              options={BODY_TYPES}
              placeholder="All Types"
            />
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-0.5">
                Street / Area
              </span>
              <div className="relative">
                <Input
                  placeholder="e.g. Kariakoo"
                  value={filters.street}
                  onChange={(e) => {
                    if (e.target.value.length <= 30) {
                      setFilters((prev) => ({ ...prev, street: e.target.value }))
                    }
                  }}
                  className="h-10 rounded-xl text-sm pr-8"
                  maxLength={30}
                />
                {filters.street && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, street: '' }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active filters + reset */}
          {activeFilterCount > 0 && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/20">
              <span className="text-[10px] text-muted-foreground">
                {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-[10px] text-primary font-medium hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                Reset all
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== ALL USERS FILTER BAR ===== */}
      {activeTab === 'all' && (
        <div className="px-4 py-2 shrink-0 border-b border-border/30 bg-background/95">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by nickname..."
                value={allSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-10 rounded-xl text-sm"
                maxLength={20}
              />
            </div>
            <button
              type="button"
              onClick={() => setAllAvailableOnly(!allAvailableOnly)}
              className={`h-10 px-4 rounded-xl text-sm font-medium transition-all ${
                allAvailableOnly
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              Available
            </button>
          </div>
        </div>
      )}

      {/* ===== UNCANCELLABLE BROADCAST BANNER ===== */}
      {activeBroadcasts.length > 0 && (
        <div className="shrink-0 border-b border-yellow-500/20 bg-yellow-500/5">
          {activeBroadcasts.map((b) => (
            <div key={b.id} className="flex items-center gap-2.5 px-4 py-2.5">
              <Shield className="w-4 h-4 text-yellow-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 truncate">
                  {b.title}
                </p>
                <p className="text-[10px] text-muted-foreground line-clamp-1">
                  {b.message}
                </p>
              </div>
              {b.action_label && b.action_url && (
                <a
                  href={b.action_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 h-7 px-3 rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-[10px] font-semibold hover:bg-yellow-500/30 transition-colors flex items-center"
                >
                  {b.action_label}
                </a>
              )}
              {/* NO dismiss/OK/X button — this banner is uncancellable */}
            </div>
          ))}
        </div>
      )}

      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center py-1 transition-all shrink-0"
          style={{ height: pullDistance }}
        >
          <RefreshCw
            className={`w-4 h-4 text-primary ${pullDistance > 50 ? 'animate-spin' : ''}`}
          />
        </div>
      )}

      {/* Content Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="flex-1 overflow-y-auto overscroll-contain gnect-scroll"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {/* ===== NEARBY TAB ===== */}
            {activeTab === 'nearby' && (
              <>
                {nearbyLoading ? (
                  renderSkeletons()
                ) : nearbyUsers.length === 0 ? (
                  renderEmpty(activeFilterCount > 0 ? 'filtered' : 'nearby')
                ) : (
                  <div className="px-4 space-y-2.5 py-2 pb-20">
                    {nearbyUsers.map((u) => (
                      <BannerCard
                        key={u.id}
                        user={u}
                        currentUserId={currentUser?.id || ''}
                        currentTags={currentTags}
                        onTap={openSpotlight}
                        onSave={handleSave}
                      />
                    ))}

                    {nearbyLoadingMore && (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                    )}

                    {!nearbyHasMore && nearbyUsers.length > 0 && (
                      <div className="text-center py-6 text-xs text-muted-foreground/50">
                        That&apos;s everyone nearby for now
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ===== ALL USERS TAB ===== */}
            {activeTab === 'all' && (
              <>
                {allLoading ? (
                  renderSkeletons()
                ) : allUsers.length === 0 ? (
                  renderEmpty(allSearch || allAvailableOnly ? 'filtered' : 'all')
                ) : (
                  <div className="px-4 space-y-2.5 py-2 pb-20">
                    {allUsers.map((u) => (
                      <BannerCard
                        key={u.id}
                        user={u}
                        currentUserId={currentUser?.id || ''}
                        currentTags={currentTags}
                        onTap={openSpotlight}
                        onSave={handleSave}
                      />
                    ))}

                    {allLoadingMore && (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                    )}

                    {!allHasMore && allUsers.length > 0 && (
                      <div className="text-center py-6 text-xs text-muted-foreground/50">
                        That&apos;s everyone for now
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Spotlight View */}
      <AnimatePresence>
        {spotlightUserId && (
          <SpotlightView
            key={spotlightUserId}
            userId={spotlightUserId}
            currentUserId={currentUser?.id || ''}
            currentTags={currentTags}
            onClose={closeSpotlight}
            onPrev={goToPrev}
            onNext={goToNext}
            hasPrev={spotlightIndex > 0}
            hasNext={spotlightIndex < (activeTab === 'nearby' ? nearbyUsers : allUsers).length - 1}
            onOpenChat={onOpenChat}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
