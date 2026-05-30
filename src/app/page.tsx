'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { AgeGate } from '@/components/auth/age-gate'
import { RegisterForm } from '@/components/auth/register-form'
import { LoginForm } from '@/components/auth/login-form'
import { AppShell } from '@/components/app-shell'

type Screen = 'age-gate' | 'register' | 'login' | 'app'

export default function Home() {
  const { isAuthenticated, setUser, isLoading, setLoading } = useAuthStore()
  const [screen, setScreen] = useState<Screen>('age-gate')

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
        const data = await res.json()
        if (data.ok && data.user) {
          setUser(data.user)
        }
      } catch {
        // No session
      } finally {
        setLoading(false)
      }
    }
    checkSession()
  }, [setUser, setLoading])

  // Derive screen from auth state
  useEffect(() => {
    if (isAuthenticated) {
      setScreen('app')
    } else {
      // Check if age gate was already confirmed before
      const ageConfirmed = typeof window !== 'undefined' && localStorage.getItem('gnect_age_confirmed')
      if (ageConfirmed === 'true') {
        setScreen('register')
      } else {
        setScreen('age-gate')
      }
    }
  }, [isAuthenticated])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-primary font-bold text-2xl tracking-tight animate-pulse">GNECT</div>
      </div>
    )
  }

  if (screen === 'app') {
    return <AppShell />
  }

  if (screen === 'age-gate') {
    return (
      <AgeGate
        onConfirm={() => {
          localStorage.setItem('gnect_age_confirmed', 'true')
          setScreen('register')
        }}
      />
    )
  }

  if (screen === 'login') {
    return <LoginForm onSwitchToRegister={() => setScreen('register')} />
  }

  return <RegisterForm onSwitchToLogin={() => setScreen('login')} />
}
