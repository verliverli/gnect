'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, RefreshCw, Plus, Flame, Clock, User, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/lib/store'
import { PostCard, type CommunityPost } from '@/components/community/post-card'
import { CreatePostSheet } from '@/components/community/create-post-sheet'
import { PostDetailView } from '@/components/community/post-detail-view'
import { toast } from 'sonner'

// ============================================
// Types
// ============================================

type CommunityTab = 'new' | 'hot' | 'my'
type CategoryFilter = 'SFW' | 'NSFW' | 'All'

// ============================================
// CommunityScreen Component
// ============================================

export function CommunityScreen() {
  const { user: currentUser } = useAuthStore()

  // Tab & filter state
  const [activeTab, setActiveTab] = useState<CommunityTab>('new')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All')

  // Posts state
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Create post sheet
  const [showCreateSheet, setShowCreateSheet] = useState(false)

  // Post detail view
  const [detailPostId, setDetailPostId] = useState<string | null>(null)

  // Pull-to-refresh state
  const [pullStartY, setPullStartY] = useState<number | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ========================================
  // Fetch posts
  // ========================================
  const fetchPosts = useCallback(async (append = false) => {
    if (!currentUser) return

    const isRefresh = !append
    if (isRefresh) setRefreshing(true)
    else if (append) setLoadingMore(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams()
      params.set('tab', activeTab)
      params.set('limit', '20')

      if (categoryFilter !== 'All') {
        params.set('category', categoryFilter)
      }

      if (append && cursor) {
        params.set('cursor', cursor)
      }

      const res = await fetch(`/api/community/posts?${params.toString()}`, { credentials: 'same-origin' })

      if (!res.ok) {
        try {
          const errData = await res.json()
          if (!append) setPosts([])
          toast.error(errData.error || 'Failed to load posts')
        } catch {
          if (!append) setPosts([])
          toast.error('Failed to load posts')
        }
        return
      }

      const data = await res.json()

      if (data.ok) {
        const newPosts = data.data || []
        if (append) {
          setPosts((prev) => [...prev, ...newPosts])
        } else {
          setPosts(newPosts)
        }
        setCursor(data.nextCursor || null)
        setHasMore(!!data.nextCursor)
      } else {
        if (!append) setPosts([])
        toast.error(data.error || 'Failed to load posts')
      }
    } catch {
      if (!append) setPosts([])
      toast.error('Network error')
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }, [currentUser, activeTab, categoryFilter, cursor])

  // ========================================
  // Initial fetch & refetch on tab/filter change
  // ========================================
  useEffect(() => {
    if (currentUser) {
      setCursor(null)
      setPosts([])
      setLoading(true)
      // We need to fetch fresh since cursor is reset
      const params = new URLSearchParams()
      params.set('tab', activeTab)
      params.set('limit', '20')
      if (categoryFilter !== 'All') params.set('category', categoryFilter)

      fetch(`/api/community/posts?${params.toString()}`, { credentials: 'same-origin' })
        .then(async (r) => {
          if (!r.ok) {
            try {
              const errData = await r.json()
              toast.error(errData.error || 'Failed to load posts')
            } catch {
              toast.error('Failed to load posts')
            }
            return null
          }
          return r.json()
        })
        .then((data) => {
          if (!data) return
          if (data.ok) {
            setPosts(data.data || [])
            setCursor(data.nextCursor || null)
            setHasMore(!!data.nextCursor)
          } else {
            setPosts([])
          }
        })
        .catch(() => setPosts([]))
        .finally(() => setLoading(false))
    }
  }, [currentUser, activeTab, categoryFilter])

  // ========================================
  // Upvote toggle handler
  // ========================================
  const handleUpvoteToggle = useCallback(async (postId: string, currentUpvoted: boolean): Promise<boolean> => {
    try {
      const res = await fetch(`/api/community/posts/${postId}/upvote`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        // Update the post in our local list
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  has_upvoted: !currentUpvoted,
                  upvotes_count: p.upvotes_count + (currentUpvoted ? -1 : 1),
                }
              : p
          )
        )
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  // ========================================
  // Infinite scroll
  // ========================================
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    if (scrollHeight - scrollTop - clientHeight < 200) {
      if (hasMore && !loadingMore && !loading && !refreshing) {
        fetchPosts(true)
      }
    }
  }, [hasMore, loadingMore, loading, refreshing, fetchPosts])

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
      setCursor(null)
      fetchPosts()
    }
    setPullStartY(null)
    setPullDistance(0)
  }

  // ========================================
  // Handle post created
  // ========================================
  const handlePostCreated = useCallback(() => {
    // Refresh feed
    setCursor(null)
    const params = new URLSearchParams()
    params.set('tab', activeTab)
    params.set('limit', '20')
    if (categoryFilter !== 'All') params.set('category', categoryFilter)

    fetch(`/api/community/posts?${params.toString()}`, { credentials: 'same-origin' })
      .then(async (r) => {
        if (!r.ok) return null
        return r.json()
      })
      .then((data) => {
        if (!data) return
        if (data.ok) {
          setPosts(data.data || [])
          setCursor(data.nextCursor || null)
          setHasMore(!!data.nextCursor)
        }
      })
      .catch(() => {})
  }, [activeTab, categoryFilter])

  // ========================================
  // Handle post deleted from detail view
  // ========================================
  const handlePostDeleted = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }, [])

  // ========================================
  // Refresh posts when detail view closes (sync upvote/comment state)
  // ========================================
  const handleDetailClose = useCallback(() => {
    setDetailPostId(null)
    // Refresh the current feed to sync any changes made in detail view
    const params = new URLSearchParams()
    params.set('tab', activeTab)
    params.set('limit', '20')
    if (categoryFilter !== 'All') params.set('category', categoryFilter)

    fetch(`/api/community/posts?${params.toString()}`, { credentials: 'same-origin' })
      .then(async (r) => {
        if (!r.ok) return null
        return r.json()
      })
      .then((data) => {
        if (!data || !data.ok) return
        setPosts(data.data || [])
        setCursor(data.nextCursor || null)
        setHasMore(!!data.nextCursor)
      })
      .catch(() => {})
  }, [activeTab, categoryFilter])

  // ========================================
  // Tab config
  // ========================================
  const tabs = useMemo(() => [
    { key: 'new' as CommunityTab, label: 'New', icon: Clock },
    { key: 'hot' as CommunityTab, label: 'Hot', icon: Flame },
    { key: 'my' as CommunityTab, label: 'My Posts', icon: User },
  ], [])

  const categoryFilters = useMemo(() => ['All', 'SFW', 'NSFW'] as CategoryFilter[], [])

  // ========================================
  // Loading skeleton
  // ========================================
  const renderSkeletons = () => (
    <div className="px-4 space-y-2.5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-3/4 mb-1" />
          <Skeleton className="h-4 w-1/2 mb-3" />
          <div className="flex items-center gap-4 pt-2 border-t border-border/30">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-3 w-8 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  )

  // ========================================
  // Empty state
  // ========================================
  const renderEmpty = () => (
    <div className="flex-1 flex flex-col items-center justify-center px-6 gap-3 py-12">
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
        <MessageSquare className="w-7 h-7 text-primary" />
      </div>
      <h3 className="text-base font-semibold text-foreground">
        {activeTab === 'my' ? "You haven't posted yet" : 'No posts yet'}
      </h3>
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        {activeTab === 'my'
          ? 'Tap the + button to ask the community something'
          : 'Be the first to ask something \uD83D\uDD25'}
      </p>
    </div>
  )

  // ========================================
  // Render
  // ========================================
  return (
    <div className="h-full flex flex-col">
      {/* Tab Bar — New | Hot | My Posts */}
      <div className="flex items-center border-b border-border/50 shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.key ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {activeTab === tab.key && (
                <motion.div
                  layoutId="community-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-background/95 shrink-0">
        {categoryFilters.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              categoryFilter === cat
                ? cat === 'SFW'
                  ? 'bg-green-500/15 text-green-500 border-green-500/30'
                  : cat === 'NSFW'
                  ? 'bg-red-500/15 text-red-500 border-red-500/30'
                  : 'bg-primary/15 text-primary border-primary/30'
                : 'bg-card text-muted-foreground border-border hover:bg-card/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

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
        className="flex-1 overflow-y-auto overscroll-contain gnect-scroll relative"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeTab}-${categoryFilter}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {loading ? (
              renderSkeletons()
            ) : posts.length === 0 ? (
              renderEmpty()
            ) : (
              <div className="px-4 space-y-2.5 py-2 pb-24">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onTap={setDetailPostId}
                    onUpvoteToggle={handleUpvoteToggle}
                  />
                ))}

                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                )}

                {!hasMore && posts.length > 0 && (
                  <div className="text-center py-6 text-xs text-muted-foreground/50">
                    That&apos;s all for now
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* FAB — Create Post */}
      <button
        onClick={() => setShowCreateSheet(true)}
        className="absolute bottom-4 right-4 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-90 transition-transform z-10"
        aria-label="Create new post"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Create Post Sheet */}
      <CreatePostSheet
        open={showCreateSheet}
        onOpenChange={setShowCreateSheet}
        onPostCreated={handlePostCreated}
      />

      {/* Post Detail View */}
      <AnimatePresence>
        {detailPostId && (
          <PostDetailView
            key={detailPostId}
            postId={detailPostId}
            onClose={handleDetailClose}
            onPostDeleted={handlePostDeleted}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
