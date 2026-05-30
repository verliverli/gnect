'use client'

import { useState, useCallback } from 'react'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

// ============================================
// STEALTH APP ICON TOGGLE — Phase 6 Privacy Feature
// Changes PWA manifest dynamically to show "Calculator"
// instead of "GNECT" on the home screen
// ============================================

function applyStealthManifest(enable: boolean) {
  if (typeof document === 'undefined') return

  const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
  if (manifestLink) {
    manifestLink.href = enable ? '/manifest-calculator.json' : '/manifest.json'
  }

  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null
  if (appleTitle) {
    appleTitle.content = enable ? 'Calculator' : 'GNECT'
  }

  document.title = enable ? 'Calculator' : 'GNECT — Hook Up'

  const iconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null
  if (iconLink) {
    iconLink.href = enable ? '/calculator-icon.svg' : '/logo.svg'
  }
}

function getStealthSetting(notificationSettings: string | undefined): boolean {
  if (!notificationSettings) return false
  try {
    const settings = JSON.parse(notificationSettings)
    return settings.stealth_icon === true
  } catch {
    return false
  }
}

export function StealthIconToggle() {
  const { user } = useAuthStore()
  const initialStealth = getStealthSetting(user?.notification_settings)
  const [stealthMode, setStealthMode] = useState(initialStealth)

  // Toggle handler
  const handleToggle = useCallback(async (enable: boolean) => {
    setStealthMode(enable)
    applyStealthManifest(enable)

    try {
      const settings = user?.notification_settings ? JSON.parse(user.notification_settings) : {}
      settings.stealth_icon = enable

      await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
        credentials: 'same-origin',
      })

      toast.success(enable ? 'Stealth icon enabled — reinstall PWA to see changes' : 'GNECT icon restored — reinstall PWA to see changes')
    } catch {
      toast.error('Failed to save preference')
    }
  }, [user])

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">Stealth App Icon</p>
        <p className="text-xs text-muted-foreground">Show as &quot;Calculator&quot; on home screen</p>
      </div>
      <Switch checked={stealthMode} onCheckedChange={handleToggle} />
    </div>
  )
}
