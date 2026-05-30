'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ThumbsUp, MessageCircle, MapPin } from 'lucide-react'
import { toast } from 'sonner'

// ============================================
// Types
// ============================================

export interface CommunityPost {
  id: string
  content: string
  category: 'SFW' | 'NSFW'
  region_tag: string | null
  upvotes_count: number
  comments_count: number
  is_own: boolean
  has_upvoted: boolean
  created_at: string
  auto_delete_at: string
}

interface PostCardProps {
  post: CommunityPost
  onTap: (postId: string) => void
  onUpvoteToggle: (postId: string, currentUpvoted: boolean) => Promise<boolean>
}

// ============================================
// Helper: relative time (same pattern as chats-screen)
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
// Truncate text to N lines with "Show more"
// ============================================

function TruncatedText({ text, maxLines = 3 }: { text: string; maxLines?: number }) {
  const [expanded, setExpanded] = useState(false)

  // If text is short enough, just show it
  if (text.length <= 150) {
    return <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">{text}</p>
  }

  return (
    <div>
      <p
        className={`text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed ${
          !expanded ? `line-clamp-${maxLines}` : ''
        }`}
        style={!expanded ? { display: '-webkit-box', WebkitLineClamp: maxLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}
      >
        {text}
      </p>
      {!expanded && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(true)
          }}
          className="text-xs text-primary font-medium mt-0.5 hover:underline"
        >
          Show more
        </button>
      )}
    </div>
  )
}

// ============================================
// PostCard Component
// ============================================

export function PostCard({ post, onTap, onUpvoteToggle }: PostCardProps) {
  const [upvoted, setUpvoted] = useState(post.has_upvoted)
  const [upvoteCount, setUpvoteCount] = useState(post.upvotes_count)
  const [upvoteLoading, setUpvoteLoading] = useState(false)

  // Sync with parent props when they change
  useEffect(() => {
    setUpvoted(post.has_upvoted)
    setUpvoteCount(post.upvotes_count)
  }, [post.has_upvoted, post.upvotes_count])

  const handleUpvote = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (upvoteLoading) return

    // Optimistic update
    const newUpvoted = !upvoted
    setUpvoted(newUpvoted)
    setUpvoteCount((prev) => newUpvoted ? prev + 1 : prev - 1)
    setUpvoteLoading(true)

    try {
      const success = await onUpvoteToggle(post.id, upvoted)
      if (!success) {
        // Revert on failure
        setUpvoted(upvoted)
        setUpvoteCount((prev) => upvoted ? prev + 1 : prev - 1)
        toast.error('Failed to update vote')
      }
    } catch {
      setUpvoted(upvoted)
      setUpvoteCount((prev) => upvoted ? prev + 1 : prev - 1)
      toast.error('Network error')
    } finally {
      setUpvoteLoading(false)
    }
  }, [upvoted, upvoteLoading, post.id, onUpvoteToggle])

  return (
    <motion.div
      whileTap={{ scale: 0.985 }}
      className="rounded-2xl border bg-card p-4 active:bg-card/80 transition-colors cursor-pointer"
      onClick={() => onTap(post.id)}
    >
      {/* Top row: Category badge + "You" badge */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            post.category === 'SFW'
              ? 'bg-green-500/15 text-green-500'
              : 'bg-red-500/15 text-red-500'
          }`}
        >
          {post.category}
        </span>
        {post.is_own && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
            You
          </span>
        )}
        {post.region_tag && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground ml-auto">
            <MapPin className="w-3 h-3" />
            {post.region_tag}
          </span>
        )}
      </div>

      {/* Content */}
      <TruncatedText text={post.content} />

      {/* Bottom row: upvote + comments + time */}
      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/30">
        {/* Upvote */}
        <button
          onClick={handleUpvote}
          disabled={upvoteLoading}
          className={`flex items-center gap-1 text-xs font-medium transition-colors min-h-[32px] min-w-[44px] ${
            upvoted
              ? 'text-primary'
              : 'text-muted-foreground hover:text-primary'
          }`}
          aria-label={upvoted ? 'Remove upvote' : 'Upvote'}
        >
          <ThumbsUp className={`w-3.5 h-3.5 ${upvoted ? 'fill-primary' : ''}`} />
          <span>{upvoteCount}</span>
        </button>

        {/* Comments */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MessageCircle className="w-3.5 h-3.5" />
          <span>{post.comments_count}</span>
        </div>

        {/* Time */}
        <span className="text-[10px] text-muted-foreground/60 ml-auto">
          {relativeTime(post.created_at)}
        </span>
      </div>
    </motion.div>
  )
}
