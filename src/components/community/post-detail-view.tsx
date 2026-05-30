'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, ThumbsUp, MapPin, Send, MoreVertical,
  Trash2, Flag, Loader2, MessageCircle
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { containsLink } from '@/lib/constants'
import { toast } from 'sonner'

// ============================================
// Types
// ============================================

interface Comment {
  id: string
  content: string
  is_own: boolean
  created_at: string
}

interface PostDetail {
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
  comments: Comment[]
}

interface PostDetailViewProps {
  postId: string
  onClose: () => void
  onPostDeleted?: (postId: string) => void
}

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
// PostDetailView Component
// ============================================

export function PostDetailView({ postId, onClose, onPostDeleted }: PostDetailViewProps) {
  const [post, setPost] = useState<PostDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [upvoted, setUpvoted] = useState(false)
  const [upvoteCount, setUpvoteCount] = useState(0)
  const [upvoteLoading, setUpvoteLoading] = useState(false)

  const [commentText, setCommentText] = useState('')
  const [sendingComment, setSendingComment] = useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)

  const [deletingCommentIds, setDeletingCommentIds] = useState<Set<string>>(new Set())

  const commentsEndRef = useRef<HTMLDivElement>(null)
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch post detail
  const fetchPost = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/community/posts/${postId}`, { credentials: 'same-origin' })

      if (!res.ok) {
        // Try to parse error JSON, but handle non-JSON responses gracefully
        try {
          const data = await res.json()
          setError(data.error || `Failed to load post (${res.status})`)
        } catch {
          setError(`Failed to load post (HTTP ${res.status})`)
        }
        return
      }

      const data = await res.json()

      if (data.ok) {
        setPost(data.post)
        setUpvoted(data.post.has_upvoted)
        setUpvoteCount(data.post.upvotes_count)
      } else {
        setError(data.error || 'Failed to load post')
      }
    } catch {
      setError('Network error — check your connection and try again')
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    fetchPost()
  }, [fetchPost])

  // Scroll to bottom of comments after load
  useEffect(() => {
    if (post && post.comments.length > 0) {
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [post])

  // Upvote toggle
  const handleUpvote = useCallback(async () => {
    if (upvoteLoading) return

    const newUpvoted = !upvoted
    setUpvoted(newUpvoted)
    setUpvoteCount((prev) => newUpvoted ? prev + 1 : prev - 1)
    setUpvoteLoading(true)

    try {
      const res = await fetch(`/api/community/posts/${postId}/upvote`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (!data.ok) {
        setUpvoted(!newUpvoted)
        setUpvoteCount((prev) => newUpvoted ? prev - 1 : prev + 1)
        toast.error(data.error || 'Failed to update vote')
      }
    } catch {
      setUpvoted(!newUpvoted)
      setUpvoteCount((prev) => newUpvoted ? prev - 1 : prev + 1)
      toast.error('Network error')
    } finally {
      setUpvoteLoading(false)
    }
  }, [upvoted, upvoteLoading, postId])

  // Add comment
  const handleSendComment = useCallback(async () => {
    if (!commentText.trim() || sendingComment) return

    setSendingComment(true)
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        const newComment: Comment = {
          id: data.comment.id,
          content: commentText.trim(),
          is_own: true,
          created_at: data.comment.created_at || new Date().toISOString(),
        }
        setPost((prev) => prev ? {
          ...prev,
          comments: [...prev.comments, newComment],
          comments_count: prev.comments_count + 1,
        } : prev)
        setCommentText('')
        // Reset textarea height after clearing
        if (commentTextareaRef.current) {
          commentTextareaRef.current.style.height = 'auto'
        }
        setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      } else {
        toast.error(data.error || 'Failed to comment')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSendingComment(false)
    }
  }, [commentText, sendingComment, postId])

  // Delete post
  const handleDelete = useCallback(async () => {
    if (deleting) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/community/posts/${postId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        toast.success('Post deleted')
        onPostDeleted?.(postId)
        onClose()
      } else {
        toast.error(data.error || 'Failed to delete')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }, [deleting, postId, onPostDeleted, onClose])

  // Report post
  const handleReport = useCallback(async () => {
    if (!reportReason.trim() || reporting) return

    setReporting(true)
    try {
      const res = await fetch(`/api/community/posts/${postId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason.trim() }),
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        toast.success('Report submitted')
        setReportDialogOpen(false)
        setReportReason('')
        onClose()
      } else {
        toast.error(data.error || 'Failed to report')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setReporting(false)
    }
  }, [reportReason, reporting, postId, onClose])

  // ========================================
  // Loading state
  // ========================================
  if (loading) {
    return (
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-50 bg-background flex flex-col"
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="flex-1 p-4 space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-12 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="pt-4 border-t space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="h-4 w-full rounded" />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  // Error state
  if (error || !post) {
    return (
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-4 p-6"
      >
        <MessageCircle className="w-12 h-12 text-muted-foreground/30" />
        <p className="text-muted-foreground text-center text-sm">{error || 'Post not found'}</p>
        <div className="flex gap-3">
          <Button variant="outline" size="lg" className="rounded-2xl h-12" onClick={fetchPost}>
            Retry
          </Button>
          <Button variant="outline" size="lg" className="rounded-2xl h-12" onClick={onClose}>
            Go Back
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* ===== HEADER ===== */}
      <div className="flex items-center gap-2 px-3 py-2 bg-background/95 backdrop-blur-sm border-b border-border/50 shrink-0 z-20">
        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full flex items-center justify-center active:bg-secondary transition-colors shrink-0"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <h2 className="text-base font-bold flex-1">Post</h2>

        {/* Options menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-10 w-10 rounded-full flex items-center justify-center active:bg-secondary transition-colors shrink-0"
              aria-label="More options"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {post.is_own && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive py-3"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Post
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive py-3"
              onClick={() => setReportDialogOpen(true)}
            >
              <Flag className="w-4 h-4 mr-2" /> Report Post
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ===== SCROLLABLE CONTENT ===== */}
      <div className="flex-1 overflow-y-auto overscroll-contain gnect-scroll pb-20">
        {/* Post content */}
        <div className="p-4 space-y-3">
          {/* Category + Region + Time */}
          <div className="flex items-center gap-2 flex-wrap">
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
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {post.region_tag}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground/50 ml-auto">
              {relativeTime(post.created_at)}
            </span>
          </div>

          {/* Full content */}
          <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
            {post.content}
          </p>

          {/* Upvote + Delete button row */}
          <div className="flex items-center gap-3 pt-2 pb-1">
            <button
              onClick={handleUpvote}
              disabled={upvoteLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                upvoted
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-primary'
              }`}
              aria-label={upvoted ? 'Remove upvote' : 'Upvote'}
            >
              <ThumbsUp className={`w-3.5 h-3.5 ${upvoted ? 'fill-primary' : ''}`} />
              {upvoteCount}
            </button>

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="w-3.5 h-3.5" />
              {post.comments_count} comment{post.comments_count !== 1 ? 's' : ''}
            </div>

            {/* Visible delete button for own posts */}
            {post.is_own && (
              <button
                onClick={() => setDeleteDialogOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all border bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20 ml-auto"
                aria-label="Delete post"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>

        {/* ===== COMMENTS SECTION ===== */}
        <div className="border-t border-border/30">
          <div className="px-4 py-2">
            <h3 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
              Comments
            </h3>
          </div>

          {post.comments.length === 0 ? (
            <div className="px-4 py-8 flex flex-col items-center gap-2">
              <MessageCircle className="w-8 h-8 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground/50">No comments yet</p>
            </div>
          ) : (
            <div className="px-4 space-y-3 pb-4">
              {post.comments.map((comment) => (
                <div key={comment.id} className="flex gap-2 group">
                  {/* Anonymous icon */}
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold text-primary/60">
                      {comment.is_own ? 'Y' : 'A'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {comment.is_own ? 'You' : 'Anonymous'}
                      </span>
                      {comment.is_own && (
                        <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[8px] font-medium bg-primary/10 text-primary">
                          You
                        </span>
                      )}
                      <span className="text-[9px] text-muted-foreground/40">
                        {relativeTime(comment.created_at)}
                      </span>
                      {/* Delete comment button */}
                      {comment.is_own && (
                        <button
                          onClick={async () => {
                            if (deletingCommentIds.has(comment.id)) return
                            setDeletingCommentIds((prev) => new Set(prev).add(comment.id))
                            try {
                              const res = await fetch(`/api/community/posts/${postId}/comments/${comment.id}`, {
                                method: 'DELETE',
                                credentials: 'same-origin',
                              })
                              const data = await res.json()
                              if (data.ok) {
                                setPost((prev) => prev ? {
                                  ...prev,
                                  comments: prev.comments.filter((c) => c.id !== comment.id),
                                  comments_count: prev.comments_count - 1,
                                } : prev)
                                toast.success('Comment deleted')
                              } else {
                                toast.error(data.error || 'Failed to delete')
                              }
                            } catch {
                              toast.error('Network error')
                            } finally {
                              setDeletingCommentIds((prev) => {
                                const next = new Set(prev)
                                next.delete(comment.id)
                                return next
                              })
                            }
                          }}
                          disabled={deletingCommentIds.has(comment.id)}
                          className="ml-auto sm:opacity-0 sm:group-hover:opacity-100 opacity-60 transition-opacity text-destructive/60 hover:text-destructive active:text-destructive p-0.5 disabled:opacity-30"
                          aria-label="Delete comment"
                        >
                          {deletingCommentIds.has(comment.id) ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={commentsEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* ===== COMMENT INPUT (fixed bottom) ===== */}
      <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-sm px-3 py-2 safe-bottom">
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <textarea
              ref={commentTextareaRef}
              value={commentText}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setCommentText(e.target.value)
                }
                // Auto-grow
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              placeholder="Add a comment..."
              className={`flex-1 w-full min-h-[44px] max-h-[120px] px-4 py-2.5 rounded-2xl border bg-card text-sm placeholder:text-muted-foreground/50 outline-none transition-all resize-none whitespace-pre-wrap break-words leading-relaxed ${
                containsLink(commentText) ? 'border-red-400/50 focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-400/20' : 'border-border focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20'
              }`}
              maxLength={500}
              rows={1}
            />
            {containsLink(commentText) && (
              <p className="text-[10px] text-red-400 mt-0.5 px-1">🔗 Links are not allowed</p>
            )}
          </div>
          <button
            onClick={handleSendComment}
            disabled={!commentText.trim() || sendingComment || containsLink(commentText)}
            className={`h-11 w-11 rounded-full flex items-center justify-center transition-all shrink-0 ${
              commentText.trim() && !sendingComment && !containsLink(commentText)
                ? 'bg-primary text-primary-foreground active:scale-90 shadow-sm'
                : 'bg-muted text-muted-foreground'
            }`}
            aria-label="Send comment"
          >
            {sendingComment ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* ===== DELETE CONFIRMATION DIALOG ===== */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Post?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Your post will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="rounded-xl"
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl gap-1.5"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== REPORT DIALOG ===== */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-destructive" /> Report Post
            </DialogTitle>
            <DialogDescription>
              Help us understand what&apos;s wrong with this post.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {['Spam', 'Harassment', 'Underage', 'Illegal', 'Other'].map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setReportReason(reason)}
                className={`w-full px-3 py-2.5 rounded-xl text-sm text-left transition-all border ${
                  reportReason === reason || (reason === 'Other' && reportReason.startsWith('Other'))
                    ? 'bg-destructive/10 text-destructive border-destructive/30 font-medium'
                    : 'bg-card text-foreground border-border hover:bg-card/80'
                }`}
              >
                {reason}
              </button>
            ))}
            {reportReason.startsWith('Other') && (
              <Input
                placeholder="Describe the issue..."
                className="rounded-xl h-11"
                maxLength={200}
                defaultValue={reportReason.startsWith('Other: ') ? reportReason.slice(7) : ''}
                onChange={(e) => setReportReason(e.target.value ? `Other: ${e.target.value}` : 'Other')}
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setReportDialogOpen(false); setReportReason('') }}
              className="rounded-xl"
              disabled={reporting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReport}
              disabled={!reportReason.trim() || reporting}
              className="rounded-xl gap-1.5"
            >
              {reporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Flag className="w-4 h-4" />
              )}
              Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
