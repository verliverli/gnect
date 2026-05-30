'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, Search, ArrowLeft, Send, ImagePlus, Clock,
  Check, CheckCheck, Eye, Lock, ChevronDown, Shield,
  Ban, Flag, XCircle, Camera, MoreVertical, Reply, Trash2,
  Ghost, Loader2, X, Smile, Maximize2
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/lib/store'
import { QUICK_REPLIES, MEDIA_LIMITS, getMediaUrl, containsLink } from '@/lib/constants'
import { toast } from 'sonner'
import { io, Socket } from 'socket.io-client'
import { ChatSelfDestruct } from '@/components/chat-self-destruct'

// ============================================
// Types
// ============================================

interface ChatListItem {
  id: string
  otherUser: {
    id: string
    nickname: string
    photo: string | null
    is_online: boolean
  }
  lastMessage: {
    content: string | null
    sent_at: string
    sender_id: string
    media_type: string | null
    is_view_once: boolean
  } | null
  unreadCount: number
  last_message_at: string
}

interface ChatMessage {
  id: string
  sender_id: string
  content: string | null
  media_url: string | null
  media_type: string | null
  is_view_once: boolean
  viewed: boolean
  reply_to_id: string | null
  sent_at: string
}

interface ViewOnceState {
  isRevealed: boolean
  timerSeconds: number
  isExpired: boolean
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

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

// ============================================
// ViewOncePhoto Component
// ============================================

function ViewOncePhoto({
  message,
  isMine,
  onReveal,
}: {
  message: ChatMessage
  isMine: boolean
  onReveal: (messageId: string) => void
}) {
  const [state, setState] = useState<{
    isRevealed: boolean
    timerSeconds: number
    isExpired: boolean
  }>({ isRevealed: false, timerSeconds: 0, isExpired: false })

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTimer = useCallback(() => {
    setState({ isRevealed: true, timerSeconds: 10, isExpired: false })
    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.timerSeconds <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return { isRevealed: false, timerSeconds: 0, isExpired: true }
        }
        return { ...prev, timerSeconds: prev.timerSeconds - 1 }
      })
    }, 1000)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // If already viewed (from server), show expired
  if (message.viewed && !state.isRevealed) {
    return (
      <div className="relative rounded-xl overflow-hidden bg-secondary/50 border border-border/50 max-w-[240px]">
        <div className="aspect-[3/4] flex flex-col items-center justify-center gap-2 p-4">
          <Eye className="w-8 h-8 text-muted-foreground/30" />
          <span className="text-xs text-muted-foreground/50">Viewed</span>
        </div>
      </div>
    )
  }

  // Timer running — show photo with countdown
  if (state.isRevealed) {
    return (
      <div className="relative rounded-xl overflow-hidden max-w-[240px]">
        <img
          src={getMediaUrl(message.media_url)!}
          alt="View-once photo"
          className="w-full aspect-[3/4] object-cover"
        />
        {/* Phase 6: Watermark — viewer's nickname as deterrent */}
        <div className="view-once-watermark">
          <span>{useAuthStore.getState().user?.nickname || ''}</span>
        </div>
        {/* Countdown overlay */}
        <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm flex items-center gap-1">
          <Clock className="w-3 h-3 text-white" />
          <span className="text-xs font-bold text-white">{state.timerSeconds}s</span>
        </div>
      </div>
    )
  }

  // Expired
  if (state.isExpired) {
    return (
      <div className="relative rounded-xl overflow-hidden bg-secondary/50 border border-border/50 max-w-[240px]">
        <div className="aspect-[3/4] flex flex-col items-center justify-center gap-2 p-4">
          <X className="w-8 h-8 text-muted-foreground/30" />
          <span className="text-xs text-muted-foreground/50">Expired</span>
        </div>
      </div>
    )
  }

  // Not yet revealed — tap to view
  return (
    <button
      onClick={() => {
        if (!isMine) {
          onReveal(message.id)
          startTimer()
        }
      }}
      className="relative rounded-xl overflow-hidden bg-secondary/50 border border-primary/20 max-w-[240px] active:scale-95 transition-transform"
    >
      <div className="aspect-[3/4] flex flex-col items-center justify-center gap-2 p-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="w-5 h-5 text-primary" />
        </div>
        <span className="text-xs text-primary font-medium">Tap to view</span>
        <span className="text-[10px] text-muted-foreground/50">View-once photo</span>
      </div>
    </button>
  )
}

// ============================================
// Chat Bubble Component
// ============================================

function ChatBubble({
  message,
  isMine,
  replyTo,
  onUnsend,
  onGhostDelete,
  viewOnceStates,
  onRevealViewOnce,
  onSelect,
  isSelected,
  onPhotoClick,
  onReply,
}: {
  message: ChatMessage
  isMine: boolean
  replyTo: ChatMessage | null
  onUnsend: (messageId: string) => void
  onGhostDelete: (messageId: string) => void
  viewOnceStates: Map<string, ViewOnceState>
  onRevealViewOnce: (messageId: string) => void
  onSelect: (messageId: string) => void
  isSelected: boolean
  onPhotoClick: (url: string) => void
  onReply: (message: ChatMessage) => void
}) {
  // Swipe-to-reply state
  const [swipeX, setSwipeX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const SWIPE_THRESHOLD = 60
  const REPLY_ICON_SHOW = 20

  // Read receipt
  const readReceipt = isMine ? (
    message.viewed ? (
      <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
    ) : (
      <Check className="w-3.5 h-3.5 text-muted-foreground/50" />
    )
  ) : null

  // Long-press handlers for message selection
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = Math.abs(touch.clientY - touchStartRef.current.y)
    // Only allow right-swipe with minimal vertical movement
    if (dx > 10 && dy < 30) {
      setIsSwiping(true)
      setSwipeX(Math.max(0, Math.min(dx * 0.6, 100))) // Dampened movement, max 100px
    } else if (dx < -10 && dy < 30) {
      // Left swipe — ignore, reset
      setIsSwiping(false)
      setSwipeX(0)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) {
      setSwipeX(0)
      setIsSwiping(false)
      return
    }

    // If swiping — check if past threshold for reply
    if (isSwiping && swipeX >= SWIPE_THRESHOLD * 0.6) {
      onReply(message)
    } else {
      // Check for long-press (no swipe)
      const duration = Date.now() - touchStartRef.current.time
      const touch = e.changedTouches[0]
      const dx = Math.abs(touch.clientX - touchStartRef.current.x)
      const dy = Math.abs(touch.clientY - touchStartRef.current.y)
      if (duration > 500 && dx < 20 && dy < 20) {
        e.preventDefault()
        onSelect(message.id)
      }
    }

    // Reset swipe state
    setSwipeX(0)
    setIsSwiping(false)
    touchStartRef.current = null
  }

  // Mouse swipe support for desktop
  const mouseStartRef = useRef<{ x: number } | null>(null)
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseStartRef.current = { x: e.clientX }
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseStartRef.current) return
    const dx = e.clientX - mouseStartRef.current.x
    if (dx > 10) {
      setIsSwiping(true)
      setSwipeX(Math.max(0, Math.min(dx * 0.6, 100)))
    }
  }
  const handleMouseUp = () => {
    if (isSwiping && swipeX >= SWIPE_THRESHOLD * 0.6) {
      onReply(message)
    }
    setSwipeX(0)
    setIsSwiping(false)
    mouseStartRef.current = null
  }

  // View-once photo
  if (message.media_type === 'view_once_photo') {
    return (
      <div
        className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1 ${isSelected ? 'ring-2 ring-primary/60 rounded-xl' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setSwipeX(0); setIsSwiping(false); mouseStartRef.current = null }}
        style={{ transform: `translateX(${swipeX}px)`, transition: isSwiping ? 'none' : 'transform 0.2s ease-out' }}
      >
        {/* Swipe reply indicator */}
        {swipeX > REPLY_ICON_SHOW && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 flex items-center">
            <Reply className="w-5 h-5 text-primary" />
          </div>
        )}
        <ViewOncePhoto message={message} isMine={isMine} onReveal={onRevealViewOnce} />
      </div>
    )
  }

  // Regular photo
  if (message.media_type === 'photo' && message.media_url) {
    const photoUrl = getMediaUrl(message.media_url)
    return (
      <div
        className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1 ${isSelected ? 'ring-2 ring-primary/60 rounded-xl' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setSwipeX(0); setIsSwiping(false); mouseStartRef.current = null }}
        style={{ transform: `translateX(${swipeX}px)`, transition: isSwiping ? 'none' : 'transform 0.2s ease-out' }}
      >
        {/* Swipe reply indicator */}
        {swipeX > REPLY_ICON_SHOW && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 flex items-center">
            <Reply className="w-5 h-5 text-primary" />
          </div>
        )}
        <div className={`max-w-[240px] ${isMine ? 'order-1' : 'order-1'}`}>
          {/* Reply preview */}
          {replyTo && (
            <div className={`text-[10px] px-2 py-1 rounded-t-xl mb-0.5 ${
              isMine ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
            }`}>
              <span className="font-medium truncate block">{replyTo.content?.slice(0, 50) || '📷 Photo'}</span>
            </div>
          )}
          <div className="relative rounded-xl overflow-hidden group">
            <img
              src={photoUrl ?? undefined}
              alt="Photo"
              className="w-full aspect-[3/4] object-cover"
              onClick={(e) => {
                if (!isSwiping && photoUrl) {
                  e.stopPropagation()
                  onPhotoClick(photoUrl)
                }
              }}
            />
            {/* View full photo overlay hint */}
            <div
              className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 cursor-pointer"
              onClick={(e) => {
                if (!isSwiping && photoUrl) {
                  e.stopPropagation()
                  onPhotoClick(photoUrl)
                }
              }}
            >
              <Maximize2 className="w-6 h-6 text-white drop-shadow-lg" />
            </div>
            {/* Hover actions for own messages */}
            {isMine && (
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-7 w-7 rounded-full bg-black/50 flex items-center justify-center">
                      <MoreVertical className="w-3 h-3 text-white" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => onUnsend(message.id)} className="text-destructive py-2">
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Unsend
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onGhostDelete(message.id)} className="text-destructive py-2">
                      <Ghost className="w-3.5 h-3.5 mr-2" /> Delete for me
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
          <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-muted-foreground/50">{formatTime(message.sent_at)}</span>
            {readReceipt}
          </div>
        </div>
      </div>
    )
  }

  // Text message
  return (
    <div
      className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setSwipeX(0); setIsSwiping(false); mouseStartRef.current = null }}
      style={{ transform: `translateX(${swipeX}px)`, transition: isSwiping ? 'none' : 'transform 0.2s ease-out' }}
    >
      {/* Swipe reply indicator */}
      {swipeX > REPLY_ICON_SHOW && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 flex items-center">
          <Reply className="w-5 h-5 text-primary" />
        </div>
      )}
      <div
        className={`relative max-w-[80%] group ${
          isMine
            ? 'bg-primary/15 text-foreground rounded-2xl rounded-br-md'
            : 'bg-secondary text-foreground rounded-2xl rounded-bl-md'
        } ${isSelected ? 'ring-2 ring-primary/60' : ''}`}
      >
        {/* Reply preview */}
        {replyTo && (
          <div className={`text-[10px] px-3 pt-2 pb-0.5 rounded-t-2xl ${
            isMine ? 'bg-primary/10 text-primary/80' : 'bg-secondary/80 text-muted-foreground'
          }`}>
            <span className="font-medium truncate block">
              {replyTo.content?.slice(0, 60) || '📷 Photo'}
            </span>
          </div>
        )}

        {/* Content */}
        <div className="px-3 py-2">
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
          <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-muted-foreground/50">{formatTime(message.sent_at)}</span>
            {readReceipt}
          </div>
        </div>

        {/* Hover actions for own messages */}
        {isMine && (
          <div className="absolute -top-1 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-6 w-6 rounded-full bg-secondary/80 flex items-center justify-center">
                  <MoreVertical className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onUnsend(message.id)} className="text-destructive py-2">
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Unsend
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onGhostDelete(message.id)} className="text-destructive py-2">
                  <Ghost className="w-3.5 h-3.5 mr-2" /> Delete for me
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Main ChatsScreen Component
// ============================================

export function ChatsScreen({ openChatWithUserId, onChatOpened, onUnreadCountChange }: { openChatWithUserId?: string | null; onChatOpened?: () => void; onUnreadCountChange?: (count: number) => void }) {
  const { user: currentUser, disappearMode } = useAuthStore()

  // Phase 6: Self-destruct timer state
  const [selfDestructHours, setSelfDestructHours] = useState<number | null>(null)

  // Phase 6: Block/Report confirmation dialogs
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const [showReportConfirm, setShowReportConfirm] = useState<string | null>(null)

  // View state
  const [view, setView] = useState<'list' | 'chat'>('list')
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [activeChatUser, setActiveChatUser] = useState<{ id: string; nickname: string; photo: string | null; is_online: boolean } | null>(null)

  // Chat list state
  const [chats, setChats] = useState<ChatListItem[]>([])
  const [chatsLoading, setChatsLoading] = useState(true)
  const [chatsCursor, setChatsCursor] = useState<string | null>(null)
  const [chatsHasMore, setChatsHasMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Messages state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesCursor, setMessagesCursor] = useState<string | null>(null)
  const [messagesHasMore, setMessagesHasMore] = useState(false)

  // Input state
  const [messageText, setMessageText] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Typing indicator
  const [otherTyping, setOtherTyping] = useState(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // View-once states
  const [viewOnceStates, setViewOnceStates] = useState<Map<string, ViewOnceState>>(new Map())

  // Message action bar (long-press selection)
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null)

  // Photo viewer lightbox
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null)

  // Socket.io
  const socketRef = useRef<Socket | null>(null)

  // Photo upload ref
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Scroll refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatListRef = useRef<HTMLDivElement>(null)

  // ============================================
  // Socket.io Connection — connects ONCE per session, not per chat
  // ============================================

  useEffect(() => {
    if (!currentUser) return

    // Determine Socket.io server URL — HuggingFace Space for cloud Socket.io
    // Production: HuggingFace cloud relay. Dev sandbox: local via Caddy gateway
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://verliverli-gnect.hf.space'
    const isExternalUrl = true // Always external — cloud-only architecture

    const socketOpts: Parameters<typeof io>[1] = {
      path: '/socket.io',       // Explicit path for HuggingFace Spaces
      query: { userId: currentUser.id },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    }

    const socket = io(socketUrl, socketOpts)

    socket.on('connect', () => {
      // Connected to chat service
    })

    socket.on('new-message', (data: { chatId: string; message: ChatMessage }) => {
      // Use functional update to access latest activeChatId via ref
      setActiveChatId((currentChatId) => {
        if (data.chatId === currentChatId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev
            return [...prev, data.message]
          })
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
        return currentChatId // Don't change the ID, just read it
      })
      // Refresh chat list
      fetchChats(true)
    })

    socket.on('typing', (data: { chatId: string; userId: string; nickname: string }) => {
      if (data.userId !== currentUser.id) {
        setOtherTyping(true)
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000)
      }
    })

    socket.on('stop-typing', (data: { chatId: string; userId: string }) => {
      if (data.userId !== currentUser.id) {
        setOtherTyping(false)
      }
    })

    socket.on('message-viewed', (data: { chatId: string; messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === data.messageId ? { ...m, viewed: true } : m))
      )
    })

    socket.on('message-unsent', (data: { chatId: string; messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId))
    })

    socket.on('chat-updated', () => {
      fetchChats(true)
    })

    socket.on('chat-deleted', (data: { chatId: string; deletedBy: string }) => {
      // If we're in this chat, close it immediately — other person deleted it
      if (data.chatId) {
        setMessages([])
        setView('list')
        setActiveChatId(null)
        setActiveChatUser(null)
        toast('Chat was deleted by the other person', { icon: '🔒' })
      }
      // Refresh chat list to remove the deleted chat
      fetchChats(true)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [currentUser]) // Only reconnect when user changes — NOT when activeChatId changes

  // Join/leave chat rooms when activeChatId changes (separate from socket connection)
  useEffect(() => {
    if (!activeChatId || !socketRef.current) return

    socketRef.current.emit('join-chat', { chatId: activeChatId })

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-chat', { chatId: activeChatId })
      }
    }
  }, [activeChatId])

  // ============================================
  // Fetch Chat List
  // ============================================

  const fetchChats = useCallback(async (refresh = false) => {
    if (!currentUser) return

    try {
      const params = new URLSearchParams()
      if (!refresh && chatsCursor) params.set('cursor', chatsCursor)

      const res = await fetch(`/api/chat/list?${params.toString()}`, { credentials: 'same-origin' })
      const data = await res.json()

      if (data.ok) {
        if (refresh || !chatsCursor) {
          setChats(data.data || [])
        } else {
          setChats((prev) => [...prev, ...(data.data || [])])
        }
        setChatsCursor(data.nextCursor || null)
        setChatsHasMore(!!data.nextCursor)
      }
    } catch {
      // Silent fail for background refresh
    } finally {
      setChatsLoading(false)
    }
  }, [currentUser, chatsCursor])

  useEffect(() => {
    if (currentUser) {
      fetchChats(true)
    }
  }, [currentUser])

  // Auto-refresh chat list periodically
  useEffect(() => {
    const interval = setInterval(() => fetchChats(true), 15000)
    return () => clearInterval(interval)
  }, [fetchChats])

  // ============================================
  // Open Chat (from external trigger like Spotlight)
  // ============================================

  useEffect(() => {
    if (openChatWithUserId && currentUser) {
      handleOpenChatWithUser(openChatWithUserId)
    }
  }, [openChatWithUserId, currentUser])

  const handleOpenChatWithUser = async (userId: string) => {
    try {
      const res = await fetch('/api/chat/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        // Fetch the other user's info
        const profileRes = await fetch(`/api/profile/${userId}`, { credentials: 'same-origin' })
        const profileData = await profileRes.json()

        const otherUser = profileData.ok
          ? {
              id: userId,
              nickname: profileData.data.nickname,
              photo: getMediaUrl(profileData.data.photos?.[0]?.catbox_url) ?? null,
              is_online: profileData.data.is_online,
            }
          : { id: userId, nickname: 'User', photo: null, is_online: false }

        // Add to local chat list immediately so it shows when returning to list
        const newChatItem: ChatListItem = {
          id: data.data.id,
          otherUser,
          lastMessage: null,
          unreadCount: 0,
          last_message_at: new Date().toISOString(),
        }
        setChats((prev) => {
          // Avoid duplicate
          if (prev.some((c) => c.id === data.data.id)) return prev
          return [newChatItem, ...prev]
        })

        openChat(data.data.id, otherUser)
        // Notify AppShell that the chat has been opened so it clears chatWithUserId
        onChatOpened?.()
      } else {
        toast.error(data.error || 'Failed to start chat')
      }
    } catch {
      toast.error('Network error')
    }
  }

  // ============================================
  // Open/Close Chat
  // ============================================

  const openChat = useCallback((chatId: string, otherUser: ChatListItem['otherUser']) => {
    setActiveChatId(chatId)
    setActiveChatUser(otherUser)
    setView('chat')
    setMessages([])
    setMessagesCursor(null)
    setReplyTo(null)
    setOtherTyping(false)
    setSelectedMessage(null)
    fetchMessages(chatId)
    // Socket room joining is handled by the activeChatId useEffect above
  }, [])

  const closeChat = useCallback(() => {
    // Socket room leaving is handled by the activeChatId useEffect cleanup
    setActiveChatId(null)
    setActiveChatUser(null)
    setView('list')
    setMessages([])
    setMessagesCursor(null)
    setReplyTo(null)
    setSelectedMessage(null)
    fetchChats(true)
  }, [fetchChats])

  // ============================================
  // Fetch Messages
  // ============================================

  const fetchMessages = useCallback(async (chatId: string, append = false) => {
    if (!currentUser) return

    setMessagesLoading(true)
    try {
      const params = new URLSearchParams()
      if (append && messagesCursor) params.set('cursor', messagesCursor)

      const res = await fetch(`/api/chat/${chatId}/messages?${params.toString()}`, { credentials: 'same-origin' })
      const data = await res.json()

      if (data.ok) {
        const newMessages = data.data || []
        if (append) {
          setMessages((prev) => [...newMessages, ...prev])
        } else {
          setMessages(newMessages)
        }
        setMessagesCursor(data.nextCursor || null)
        setMessagesHasMore(!!data.nextCursor)

        // Scroll to bottom on initial load
        if (!append) {
          setTimeout(() => messagesEndRef.current?.scrollIntoView(), 50)
        }
      }
    } catch {
      toast.error('Failed to load messages')
    } finally {
      setMessagesLoading(false)
    }
  }, [currentUser, messagesCursor])

  // Load more messages on scroll up
  const handleMessageScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.target as HTMLDivElement
    if (el.scrollTop < 100 && messagesHasMore && !messagesLoading) {
      fetchMessages(activeChatId!, true)
    }
  }, [activeChatId, messagesHasMore, messagesLoading, fetchMessages])

  // ============================================
  // Send Message
  // ============================================

  const handleSend = useCallback(async () => {
    if (!activeChatId || (!messageText.trim() && !replyTo) || sending) return

    setSending(true)
    try {
      const res = await fetch(`/api/chat/${activeChatId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: messageText.trim(),
          reply_to_id: replyTo?.id || null,
        }),
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        const newMsg: ChatMessage = {
          id: data.data.id,
          sender_id: currentUser!.id,
          content: messageText.trim(),
          media_url: null,
          media_type: null,
          is_view_once: false,
          viewed: false,
          reply_to_id: replyTo?.id || null,
          sent_at: data.data.sent_at,
        }

        setMessages((prev) => [...prev, newMsg])
        setMessageText('')
        setReplyTo(null)

        // Emit via socket
        socketRef.current?.emit('send-message', {
          chatId: activeChatId,
          message: newMsg,
        })

        // Scroll to bottom
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

        // Stop typing
        socketRef.current?.emit('stop-typing', { chatId: activeChatId, userId: currentUser!.id })
      } else {
        toast.error(data.error || 'Failed to send')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSending(false)
    }
  }, [activeChatId, messageText, replyTo, sending, currentUser])

  // ============================================
  // Typing Indicator
  // ============================================

  const handleTyping = useCallback((value: string) => {
    setMessageText(value)

    if (!activeChatId || !currentUser) return

    // Emit typing
    socketRef.current?.emit('typing', {
      chatId: activeChatId,
      userId: currentUser.id,
      nickname: currentUser.nickname,
    })

    // Auto stop typing after 3 seconds of inactivity
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('stop-typing', {
        chatId: activeChatId!,
        userId: currentUser!.id,
      })
    }, 3000)
  }, [activeChatId, currentUser])

  // ============================================
  // Photo Upload
  // ============================================

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeChatId) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPEG, PNG, and WebP allowed')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Photo must be under 2MB')
      return
    }

    setUploading(true)
    try {
      // Upload to Catbox
      const formData = new FormData()
      formData.append('photo', file)

      const uploadRes = await fetch(`/api/chat/${activeChatId}/upload-media`, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      })
      const uploadData = await uploadRes.json()

      if (!uploadData.ok) {
        toast.error(uploadData.error || 'Upload failed')
        return
      }

      // Send as message
      const res = await fetch(`/api/chat/${activeChatId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_url: uploadData.data.url,
          media_type: 'photo',
          reply_to_id: replyTo?.id || null,
        }),
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        const newMsg: ChatMessage = {
          id: data.data.id,
          sender_id: currentUser!.id,
          content: null,
          media_url: uploadData.data.url,
          media_type: 'photo',
          is_view_once: false,
          viewed: false,
          reply_to_id: replyTo?.id || null,
          sent_at: data.data.sent_at,
        }

        setMessages((prev) => [...prev, newMsg])
        setReplyTo(null)

        socketRef.current?.emit('send-message', {
          chatId: activeChatId,
          message: newMsg,
        })

        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      } else {
        toast.error(data.error || 'Failed to send photo')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setUploading(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  // ============================================
  // View-Once Photo Reveal
  // ============================================

  const handleRevealViewOnce = useCallback(async (messageId: string) => {
    if (!activeChatId) return

    try {
      await fetch(`/api/chat/${activeChatId}/view-once?messageId=${messageId}`, {
        method: 'PUT',
        credentials: 'same-origin',
      })

      socketRef.current?.emit('view-once-opened', { chatId: activeChatId, messageId })
    } catch {
      // Silent fail
    }
  }, [activeChatId])

  // ============================================
  // Unsend / Ghost Delete
  // ============================================

  const handleUnsend = useCallback(async (messageId: string) => {
    if (!activeChatId) return

    try {
      const res = await fetch(`/api/chat/${activeChatId}/unsend?messageId=${messageId}`, {
        method: 'PUT',
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
        socketRef.current?.emit('message-unsent', { chatId: activeChatId, messageId })
        toast.success('Message unsent')
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    }
  }, [activeChatId])

  const handleGhostDelete = useCallback(async (messageId: string) => {
    if (!activeChatId) return

    try {
      const res = await fetch(`/api/chat/${activeChatId}/ghost-delete?messageId=${messageId}`, {
        method: 'PUT',
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
        toast.success('Deleted for you')
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    }
  }, [activeChatId])

  // ============================================
  // Quick Reply
  // ============================================

  const handleQuickReply = useCallback((text: string) => {
    setMessageText(text)
    // Focus input
  }, [])

  // ============================================
  // Block/Report from Chat
  // ============================================

  const handleBlockFromChat = async () => {
    setShowBlockConfirm(false) // Close dialog first
    if (!activeChatUser) return
    try {
      const res = await fetch('/api/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeChatUser.id }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('User blocked. You won\'t see them anymore.')
        closeChat()
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleReportFromChat = async (reason: string) => {
    setShowReportConfirm(null) // Close dialog first
    if (!activeChatUser) return
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeChatUser.id, reason }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Report submitted. You won\'t see this person anymore.')
        closeChat()
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    }
  }

  // Delete entire chat for BOTH users — hookup privacy, no trace
  const handleDeleteChat = async () => {
    if (!activeChatId) return
    try {
      const res = await fetch(`/api/chat/${activeChatId}/delete`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        // Notify other user via socket — chat is gone for both
        socketRef.current?.emit('chat-deleted', { chatId: activeChatId, deletedBy: currentUser!.id })
        toast.success('Chat deleted — no trace 🔒')
        closeChat()
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    }
  }

  // ============================================
  // Build reply-to map
  // ============================================

  const messageMap = useMemo(() => {
    const map = new Map<string, ChatMessage>()
    for (const m of messages) {
      map.set(m.id, m)
    }
    return map
  }, [messages])

  // ============================================
  // Filtered chats for search
  // ============================================

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats
    const q = searchQuery.toLowerCase()
    return chats.filter((c) => c.otherUser.nickname.toLowerCase().includes(q))
  }, [chats, searchQuery])

  // Calculate total unread count and notify parent
  const totalUnread = useMemo(() => {
    return chats.reduce((sum, c) => sum + c.unreadCount, 0)
  }, [chats])

  useEffect(() => {
    onUnreadCountChange?.(totalUnread)
  }, [totalUnread, onUnreadCountChange])

  // ============================================
  // RENDER: Chat List
  // ============================================

  const renderChatList = () => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 shrink-0">
        <h2 className="text-lg font-bold">Chats</h2>
      </div>

      {/* Search */}
      <div className="px-3 py-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl text-sm"
            maxLength={20}
          />
        </div>
      </div>

      {/* Chat List */}
      <div ref={chatListRef} className="flex-1 overflow-y-auto gnect-scroll">
        {chatsLoading ? (
          <div className="px-4 space-y-3 py-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-3 py-12">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {chats.length === 0 ? 'No conversations yet' : 'No matches'}
            </h3>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              {chats.length === 0
                ? 'Discover people and start chatting 💬'
                : 'Try a different search'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filteredChats.map((chat) => (
              <motion.button
                key={chat.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => openChat(chat.id, chat.otherUser)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-card/50 active:bg-card/80 transition-colors"
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-primary/10">
                    {chat.otherUser.photo && !disappearMode ? (
                      <img
                        src={getMediaUrl(chat.otherUser.photo) ?? undefined}
                        alt={chat.otherUser.nickname}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-primary font-bold text-lg">
                        {chat.otherUser.nickname.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  {/* Online dot */}
                  {chat.otherUser.is_online && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate">{chat.otherUser.nickname}</span>
                    {chat.lastMessage && !disappearMode && (
                      <span className="text-[10px] text-muted-foreground/50 shrink-0">
                        {relativeTime(chat.lastMessage.sent_at)}
                      </span>
                    )}
                  </div>
                  {/* Phase 6: Disappear Mode — hide content */}
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate">
                      {disappearMode ? (
                        <span className="text-muted-foreground/40">Message hidden</span>
                      ) : chat.lastMessage ? (
                        <>
                          {chat.lastMessage.sender_id === currentUser?.id && (
                            <span className="text-muted-foreground/50">You: </span>
                          )}
                          {chat.lastMessage.media_type === 'view_once_photo'
                            ? '🔒 View-once photo'
                            : chat.lastMessage.media_type === 'photo'
                            ? '📷 Photo'
                            : chat.lastMessage.content || '📷'}
                        </>
                      ) : (
                        'Start chatting...'
                      )}
                    </p>
                    {chat.unreadCount > 0 && !disappearMode && (
                      <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // ============================================
  // RENDER: Chat View
  // ============================================

  const renderChatView = () => (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Chat Header — stays fixed at top, never disappears */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-background/95 backdrop-blur-sm shrink-0 z-10">
        <button
          onClick={closeChat}
          className="h-10 w-10 rounded-full flex items-center justify-center active:bg-secondary transition-colors shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Avatar + Name */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-primary/10">
              {activeChatUser?.photo ? (
                <img
                  src={getMediaUrl(activeChatUser.photo) ?? undefined}
                  alt={activeChatUser.nickname}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary font-bold text-sm">
                  {activeChatUser?.nickname?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
            </div>
            {activeChatUser?.is_online && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{activeChatUser?.nickname}</p>
            {otherTyping ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[10px] text-primary font-medium"
              >
                typing...
              </motion.p>
            ) : activeChatUser?.is_online ? (
              <p className="text-[10px] text-emerald-500 font-medium">Online</p>
            ) : null}
          </div>
        </div>

        {/* Safety dropdown + Phase 6: Self-destruct timer + Block/Report confirmations */}
        <div className="flex items-center gap-1">
          {/* Phase 6: Self-destruct timer */}
          {activeChatId && (
            <ChatSelfDestruct
              chatId={activeChatId}
              activeHours={selfDestructHours}
              onSetTimer={setSelfDestructHours}
            />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-9 w-9 rounded-full flex items-center justify-center active:bg-secondary transition-colors shrink-0">
                <Shield className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="text-destructive focus:text-destructive py-3" onClick={() => setShowBlockConfirm(true)}>
                <Ban className="w-4 h-4 mr-2" /> Block
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive py-3" onClick={() => setShowReportConfirm('Fake')}>
                <Flag className="w-4 h-4 mr-2" /> Report Fake
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive py-3" onClick={() => setShowReportConfirm('Spam')}>
                <Flag className="w-4 h-4 mr-2" /> Report Spam
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive py-3" onClick={() => setShowReportConfirm('Harassment')}>
                <Flag className="w-4 h-4 mr-2" /> Report Harassment
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive py-3" onClick={() => setShowReportConfirm('Underage')}>
                <Flag className="w-4 h-4 mr-2" /> Report Underage
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive py-3" onClick={handleDeleteChat}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Phase 6: Block Confirmation Dialog */}
      <Dialog open={showBlockConfirm} onOpenChange={setShowBlockConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Block {activeChatUser?.nickname}?</DialogTitle>
            <DialogDescription>
              They won\'t be able to contact you or see your profile. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBlockConfirm(false)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleBlockFromChat} className="rounded-xl">Block</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phase 6: Report Confirmation Dialog */}
      <Dialog open={!!showReportConfirm} onOpenChange={() => setShowReportConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Report {activeChatUser?.nickname}?</DialogTitle>
            <DialogDescription>
              You\'re reporting for: <span className="font-semibold text-foreground">{showReportConfirm}</span>. They won\'t see you anymore after this.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReportConfirm(null)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={() => showReportConfirm && handleReportFromChat(showReportConfirm)} className="rounded-xl">Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Message Action Bar (WhatsApp-style) */}
      <AnimatePresence>
        {selectedMessage && (() => {
          const selectedMsg = messageMap.get(selectedMessage)
          const isSelectedMine = selectedMsg?.sender_id === currentUser?.id
          return (
            <motion.div
              key="action-bar"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.15 }}
              className="shrink-0 flex items-center justify-center gap-2 px-3 py-2 bg-foreground/90 backdrop-blur-sm z-20"
            >
              {/* Reply */}
              <button
                onClick={() => {
                  if (selectedMsg) setReplyTo(selectedMsg)
                  setSelectedMessage(null)
                }}
                className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] rounded-lg active:opacity-70 transition-opacity"
                aria-label="Reply"
              >
                <Reply className="w-5 h-5 text-background" />
                <span className="text-[10px] text-background/80 font-medium">Reply</span>
              </button>

              {/* Unsend — only for own messages */}
              {isSelectedMine && (
                <button
                  onClick={() => {
                    handleUnsend(selectedMessage)
                    setSelectedMessage(null)
                  }}
                  className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] rounded-lg active:opacity-70 transition-opacity"
                  aria-label="Unsend"
                >
                  <Trash2 className="w-5 h-5 text-red-400" />
                  <span className="text-[10px] text-red-400 font-medium">Unsend</span>
                </button>
              )}

              {/* Delete for me — only for own messages */}
              {isSelectedMine && (
                <button
                  onClick={() => {
                    handleGhostDelete(selectedMessage)
                    setSelectedMessage(null)
                  }}
                  className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] rounded-lg active:opacity-70 transition-opacity"
                  aria-label="Delete for me"
                >
                  <Ghost className="w-5 h-5 text-red-400" />
                  <span className="text-[10px] text-red-400 font-medium">Delete for me</span>
                </button>
              )}

              {/* Close */}
              <button
                onClick={() => setSelectedMessage(null)}
                className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] rounded-lg active:opacity-70 transition-opacity ml-1"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-background/70" />
                <span className="text-[10px] text-background/70 font-medium">Close</span>
              </button>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* Messages Area */}
      <div
        onScroll={handleMessageScroll}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain gnect-scroll px-3 py-2"
      >
        {/* Load more button */}
        {messagesHasMore && (
          <div className="flex justify-center py-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-8 rounded-full"
              onClick={() => fetchMessages(activeChatId!, true)}
              disabled={messagesLoading}
            >
              {messagesLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Load earlier'}
            </Button>
          </div>
        )}

        {/* Loading state */}
        {messagesLoading && messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!messagesLoading && messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Say hey 👋
            </p>
          </div>
        )}

        {/* Messages */}
        <AnimatePresence>
          {messages.map((msg) => {
            const isMine = msg.sender_id === currentUser?.id
            const replyToMsg = msg.reply_to_id ? (messageMap.get(msg.reply_to_id) ?? null) : null

            return (
              <ChatBubble
                key={msg.id}
                message={msg}
                isMine={isMine}
                replyTo={replyToMsg}
                onUnsend={handleUnsend}
                onGhostDelete={handleGhostDelete}
                viewOnceStates={viewOnceStates}
                onRevealViewOnce={handleRevealViewOnce}
                onSelect={setSelectedMessage}
                isSelected={selectedMessage === msg.id}
                onPhotoClick={(url) => setViewerImageUrl(url)}
                onReply={(msg) => { setReplyTo(msg); setSelectedMessage(null) }}
              />
            )
          })}
        </AnimatePresence>

        {/* Typing indicator */}
        {otherTyping && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start mb-1"
          >
            <div className="bg-secondary rounded-2xl rounded-bl-md px-3 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border/30 bg-card/50"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <Reply className="w-3.5 h-3.5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-primary font-medium">Replying</p>
                <p className="text-xs text-muted-foreground truncate">
                  {replyTo.content?.slice(0, 50) || '📷 Photo'}
                </p>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-secondary"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Replies */}
      <div className="shrink-0 border-t border-border/20 bg-card/30 px-2 py-1.5">
        <div className="flex gap-1.5 overflow-x-auto gnect-scroll pb-0.5">
          {QUICK_REPLIES.map((qr) => (
            <button
              key={qr}
              onClick={() => handleQuickReply(qr)}
              className="shrink-0 px-3 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95 transition-all whitespace-nowrap"
            >
              {qr}
            </button>
          ))}
        </div>
      </div>

      {/* Message Input — WhatsApp-style: Enter = newline, send button only */}
      <div className="shrink-0 border-t border-border/50 bg-background px-3 py-2 safe-bottom flex items-end gap-2">
        {/* Photo button */}
        <button
          onClick={() => photoInputRef.current?.click()}
          disabled={uploading}
          className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 active:bg-secondary transition-colors"
          aria-label="Send photo"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <Camera className="w-5 h-5 text-muted-foreground" />
          )}
        </button>

        {/* Text input — auto-resize textarea, Enter = newline */}
        <div className="flex-1 min-w-0">
          <textarea
            value={messageText}
            onChange={(e) => {
              handleTyping(e.target.value)
              // Auto-resize: reset height then set to scrollHeight
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            placeholder="Type a message..."
            className={`w-full resize-none rounded-2xl text-sm px-4 py-2.5 bg-secondary/50 border-0 outline-none focus:ring-1 max-h-[120px] overflow-y-auto gnect-scroll ${
              containsLink(messageText) ? 'focus:ring-red-400' : 'focus:ring-primary/30'
            }`}
            maxLength={2000}
            disabled={sending}
            rows={1}
            style={{ height: '40px' }}
          />
          {containsLink(messageText) && (
            <p className="text-[10px] text-red-400 mt-0.5 px-1">🔗 Links are not allowed</p>
          )}
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!messageText.trim() || sending || containsLink(messageText)}
          className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 ${
            messageText.trim()
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-secondary text-muted-foreground'
          }`}
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Hidden photo input */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handlePhotoUpload}
      />

      {/* Photo Viewer Lightbox */}
      <AnimatePresence>
        {viewerImageUrl && (
          <motion.div
            key="photo-viewer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
            onClick={() => setViewerImageUrl(null)}
          >
            {/* Close button */}
            <button
              onClick={() => setViewerImageUrl(null)}
              className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center z-10 active:scale-90 transition-transform"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            {/* Image */}
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              src={viewerImageUrl}
              alt="Full photo"
              className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  // ============================================
  // Main Render
  // ============================================

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0, x: view === 'chat' ? 20 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: view === 'chat' ? -20 : 20 }}
        transition={{ duration: 0.15 }}
        className="h-full"
      >
        {view === 'list' ? renderChatList() : renderChatView()}
      </motion.div>
    </AnimatePresence>
  )
}
