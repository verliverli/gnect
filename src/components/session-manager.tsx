'use client'

import { useState, useEffect } from 'react'
import { Smartphone, Monitor, LogOut, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

// ============================================
// SESSION MANAGER — Phase 6 Privacy Feature
// Shows current session info and logout-all option
// ============================================

export function SessionManager() {
  const [loggingOut, setLoggingOut] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState({ browser: 'Unknown', os: 'Unknown', device: 'Unknown' })

  // Parse user agent on mount
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const ua = navigator.userAgent

    // Parse browser
    let browser = 'Unknown Browser'
    if (ua.includes('Firefox')) browser = 'Firefox'
    else if (ua.includes('SamsungBrowser')) browser = 'Samsung Internet'
    else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera'
    else if (ua.includes('Edg')) browser = 'Edge'
    else if (ua.includes('Chrome')) browser = 'Chrome'
    else if (ua.includes('Safari')) browser = 'Safari'

    // Parse OS
    let os = 'Unknown OS'
    if (ua.includes('Windows')) os = 'Windows'
    else if (ua.includes('Mac OS')) os = 'macOS'
    else if (ua.includes('Android')) os = 'Android'
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
    else if (ua.includes('Linux')) os = 'Linux'

    // Parse device
    let device = 'Desktop'
    if (/Mobi|Android|iPhone/i.test(ua)) device = 'Mobile'
    else if (/iPad|Tablet/i.test(ua)) device = 'Tablet'

    setDeviceInfo({ browser, os, device })
  }, [])

  const handleLogoutAll = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
      toast.success('Logged out from all devices. Please change your password for full security.')
      // Reload to force re-login
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      toast.error('Failed to logout')
    } finally {
      setLoggingOut(false)
    }
  }

  const DeviceIcon = deviceInfo.device === 'Mobile' ? Smartphone : Monitor

  return (
    <div className="space-y-4">
      {/* Current session */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/50 border border-border/50">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <DeviceIcon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Current Session</p>
          <p className="text-xs text-muted-foreground">
            {deviceInfo.browser} on {deviceInfo.os}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {deviceInfo.device} · Active now
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-semibold">
          Active
        </span>
      </div>

      {/* Logout all button */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          To logout from all devices, you&apos;ll need to re-login after. For full security, also change your password.
        </p>
        <Button
          variant="destructive"
          className="w-full rounded-xl h-11"
          onClick={handleLogoutAll}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4 mr-2" />
          )}
          Logout Everywhere
        </Button>
      </div>
    </div>
  )
}
