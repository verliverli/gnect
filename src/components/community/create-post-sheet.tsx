'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Send, MapPin, Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/lib/store'
import { containsLink } from '@/lib/constants'
import { toast } from 'sonner'

// ============================================
// Types
// ============================================

interface CreatePostSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPostCreated: () => void
}

// ============================================
// CreatePostSheet Component
// ============================================

export function CreatePostSheet({ open, onOpenChange, onPostCreated }: CreatePostSheetProps) {
  const { user } = useAuthStore()

  const [content, setContent] = useState('')
  const [category, setCategory] = useState<'SFW' | 'NSFW'>('SFW')
  const [tagRegion, setTagRegion] = useState(false)
  const [posting, setPosting] = useState(false)
  const [dailyCount, setDailyCount] = useState(0)
  const [dailyLimit, setDailyLimit] = useState(5)
  const [loadingCount, setLoadingCount] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const MAX_CHARS = 2000
  const remaining = MAX_CHARS - content.length
  const hasLink = containsLink(content)
  const isValid = content.trim().length > 0 && content.length <= MAX_CHARS && !hasLink

  // Fetch daily count when sheet opens
  useEffect(() => {
    if (open) {
      setLoadingCount(true)
      fetch('/api/community/daily-count', { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            setDailyCount(d.count)
            setDailyLimit(d.limit)
          }
        })
        .catch(() => {})
        .finally(() => setLoadingCount(false))
    }
  }, [open])

  // Reset form when sheet closes
  useEffect(() => {
    if (!open) {
      setContent('')
      setCategory('SFW')
      setTagRegion(false)
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }, [open])

  const handlePost = useCallback(async () => {
    if (!isValid || posting) return

    setPosting(true)
    try {
      const body: { content: string; category: string; region_tag?: string } = {
        content: content.trim(),
        category,
      }

      if (tagRegion && user?.region) {
        body.region_tag = user.region
      }

      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'same-origin',
      })

      const data = await res.json()

      if (data.ok) {
        toast.success('Posted anonymously!')
        setDailyCount((prev) => prev + 1)
        onOpenChange(false)
        onPostCreated()
      } else {
        toast.error(data.error || 'Failed to post')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setPosting(false)
    }
  }, [content, category, tagRegion, user, isValid, posting, onOpenChange, onPostCreated])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85dvh] px-4 pb-6 pt-4">
        <SheetHeader className="px-0">
          <SheetTitle className="text-left">Ask the Community</SheetTitle>
          <SheetDescription className="text-left text-xs">
            Post anonymously. Be respectful. Posts auto-delete after 7 days.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto gnect-scroll space-y-4 mt-2">
          {/* Textarea */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                if (e.target.value.length <= MAX_CHARS) {
                  setContent(e.target.value)
                }
                // Auto-grow
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
              }}
              placeholder="What's on your mind? Ask anything..."
              className={`w-full min-h-[120px] max-h-[200px] resize-none rounded-xl border bg-card px-3 py-3 text-sm placeholder:text-muted-foreground/50 outline-none transition-all ${
                hasLink ? 'border-red-400/50 focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-400/20' : 'border-border focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20'
              }`}
              maxLength={MAX_CHARS}
            />
            {/* Link warning + Character counter */}
            <div className="absolute bottom-2 right-3 flex items-center gap-2">
              {hasLink && (
                <span className="text-[10px] text-red-400 font-medium">🔗 No links</span>
              )}
              <span
                className={`text-[10px] font-medium ${
                  remaining < 100
                    ? remaining < 0
                      ? 'text-destructive'
                      : 'text-amber-500'
                    : 'text-muted-foreground/50'
                }`}
              >
                {remaining}
              </span>
            </div>
          </div>

          {/* Category picker */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
              Category
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCategory('SFW')}
                className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all border ${
                  category === 'SFW'
                    ? 'bg-green-500/15 text-green-500 border-green-500/30'
                    : 'bg-card text-muted-foreground border-border hover:bg-card/80'
                }`}
              >
                SFW
              </button>
              <button
                type="button"
                onClick={() => setCategory('NSFW')}
                className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all border ${
                  category === 'NSFW'
                    ? 'bg-red-500/15 text-red-500 border-red-500/30'
                    : 'bg-card text-muted-foreground border-border hover:bg-card/80'
                }`}
              >
                NSFW
              </button>
            </div>
          </div>

          {/* Region tag toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary/70" />
              <div>
                <p className="text-sm font-medium">Tag my region</p>
                {user?.region && (
                  <p className="text-[10px] text-muted-foreground">{user.region}</p>
                )}
              </div>
            </div>
            <Switch
              checked={tagRegion}
              onCheckedChange={setTagRegion}
              aria-label="Tag region"
            />
          </div>

          {/* Daily post counter */}
          <div className="flex items-center justify-between px-1">
            {loadingCount ? (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            ) : (
              <span className="text-[10px] text-muted-foreground/60">
                {dailyCount}/{dailyLimit} posts today
              </span>
            )}
            {dailyCount >= dailyLimit && (
              <span className="text-[10px] text-amber-500 font-medium">
                Daily limit reached
              </span>
            )}
          </div>
        </div>

        {/* Post button */}
        <div className="mt-4 pt-3 border-t border-border/30">
          <button
            onClick={handlePost}
            disabled={!isValid || posting || dailyCount >= dailyLimit}
            className={`w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              isValid && !posting && dailyCount < dailyLimit
                ? 'bg-primary text-primary-foreground active:scale-[0.97] shadow-sm'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {posting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Post Anonymously
              </>
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
