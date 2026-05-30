'use client'

import { useEffect, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from './store'

// ============================================
// GNECT Real-time Notification Socket Hook
// Connects to Socket.io server and listens for
// notification + broadcast events in real-time
// ============================================

export interface NotificationData {
  id: string
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
  is_read: boolean
  created_at: string
}

export function useNotificationSocket(onNewNotification?: (notif: NotificationData) => void) {
  const { user } = useAuthStore()
  const socketRef = useRef<Socket | null>(null)
  const onNotifRef = useRef(onNewNotification)

  // Keep the callback ref up-to-date without triggering socket reconnection
  useEffect(() => {
    onNotifRef.current = onNewNotification
  }, [onNewNotification])

  useEffect(() => {
    if (!user) return

    // Determine Socket.io server URL
    // Production: HuggingFace Space (cloud relay). Dev sandbox: local via Caddy gateway
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://verliverli-gnect.hf.space'
    const isExternalUrl = true // Always external — cloud-only architecture

    const socketOpts: Parameters<typeof io>[1] = {
      path: '/socket.io',
      query: { userId: user.id },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    }

    const socket = io(socketUrl, socketOpts)
    socketRef.current = socket

    socket.on('connect', () => {
      // Join personal room for notifications
      socket.emit('join-notifications', { userId: user.id })
    })

    // Listen for real-time notifications
    socket.on('notification', (data: NotificationData) => {

      // Play discreet notification sound
      playNotificationSound()

      // Callback to update UI
      if (onNotifRef.current) {
        onNotifRef.current(data)
      }
    })

    // Listen for admin broadcasts
    socket.on('broadcast', (data: NotificationData) => {

      // Play broadcast sound (slightly different)
      playBroadcastSound()

      if (onNotifRef.current) {
        onNotifRef.current(data)
      }
    })

    socket.on('disconnect', () => {})

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [user])

  return socketRef
}

// ============================================
// Discreet Notification Sounds (Web Audio API)
// Very subtle — user barely notices, but
// gets a subconscious "something happened" cue
// ============================================

function playNotificationSound() {
  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.connect(gain)
    gain.connect(ctx.destination)

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(800, ctx.currentTime) // Subtle high tone
    gain.gain.setValueAtTime(0.08, ctx.currentTime) // Very quiet
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.15)

    // Auto-close context after sound
    oscillator.onended = () => ctx.close()
  } catch {
    // Web Audio API may not be available
  }
}

function playBroadcastSound() {
  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.connect(gain)
    gain.connect(ctx.destination)

    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(600, ctx.currentTime)
    oscillator.frequency.setValueAtTime(800, ctx.currentTime + 0.1) // Two-tone
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.25)

    // Auto-close context after sound
    oscillator.onended = () => ctx.close()
  } catch {
    // Web Audio API may not be available
  }
}
