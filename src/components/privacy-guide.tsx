'use client'

import { X, ChevronRight, Shield, EyeOff, Zap, Clock, Camera, MessageCircle, Smartphone, Lock, AlertTriangle, Trash2, Ban, Music, Eye, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

// ============================================
// PRIVACY & SAFETY GUIDE — Phase 6
// Comprehensive help panel explaining all
// privacy features and how to access them
// ============================================

interface PrivacyGuideProps {
  onClose: () => void
}

type GuideSection = 'emergency' | 'disguise' | 'chat' | 'screenshot' | 'autodelete' | 'block' | 'security' | null

const SECTIONS: {
  id: GuideSection
  icon: React.ReactNode
  title: string
  subtitle: string
  color: string
}[] = [
  {
    id: 'emergency',
    icon: <Zap className="w-5 h-5" />,
    title: 'Emergency Exit',
    subtitle: 'Instant redirect if someone sees your screen',
    color: 'text-red-500 bg-red-500/10',
  },
  {
    id: 'disguise',
    icon: <EyeOff className="w-5 h-5" />,
    title: 'Disguise & Stealth',
    subtitle: 'Hide the app icon, notification style, chat content',
    color: 'text-purple-500 bg-purple-500/10',
  },
  {
    id: 'chat',
    icon: <MessageCircle className="w-5 h-5" />,
    title: 'Chat Privacy',
    subtitle: 'View-once, ghost delete, self-destruct, watermarks',
    color: 'text-primary bg-primary/10',
  },
  {
    id: 'screenshot',
    icon: <Camera className="w-5 h-5" />,
    title: 'Anti-Screenshot',
    subtitle: 'Blur, block, detect, and deter screenshots',
    color: 'text-orange-500 bg-orange-500/10',
  },
  {
    id: 'autodelete',
    icon: <Clock className="w-5 h-5" />,
    title: 'Auto-Delete',
    subtitle: 'Messages and media disappear automatically',
    color: 'text-blue-500 bg-blue-500/10',
  },
  {
    id: 'block',
    icon: <Ban className="w-5 h-5" />,
    title: 'Block & Report',
    subtitle: 'Protect yourself from unwanted users',
    color: 'text-destructive bg-destructive/10',
  },
  {
    id: 'security',
    icon: <Lock className="w-5 h-5" />,
    title: 'Account Security',
    subtitle: 'Sessions, Not Today, link blocking',
    color: 'text-emerald-500 bg-emerald-500/10',
  },
]

export function PrivacyGuide({ onClose }: PrivacyGuideProps) {
  const [openSection, setOpenSection] = useState<GuideSection>(null)

  const toggleSection = (id: GuideSection) => {
    setOpenSection(openSection === id ? null : id)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Privacy & Safety Guide
          </h2>
          <p className="text-xs text-muted-foreground">How to use every privacy feature</p>
        </div>
      </div>

      {/* Intro banner */}
      <div className="mx-4 mt-4 p-4 rounded-2xl bg-primary/5 border border-primary/10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">Your privacy is #1</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              GNECT is built for your safety. Every feature below is designed to protect you in real situations. 
              Learn how each one works and where to find it.
            </p>
          </div>
        </div>
      </div>

      {/* Sections list */}
      <div className="flex-1 overflow-y-auto overscroll-contain gnect-scroll px-4 py-3 space-y-2">
        {SECTIONS.map((section) => (
          <div key={section.id} className="rounded-2xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center gap-3 p-4 text-left min-h-[52px]"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${section.color}`}>
                {section.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{section.title}</p>
                <p className="text-xs text-muted-foreground truncate">{section.subtitle}</p>
              </div>
              <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-150 ${openSection === section.id ? 'rotate-90' : ''}`} />
            </button>

            <AnimatePresence>
              {openSection === section.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-0">
                    {section.id === 'emergency' && <EmergencySection />}
                    {section.id === 'disguise' && <DisguiseSection />}
                    {section.id === 'chat' && <ChatPrivacySection />}
                    {section.id === 'screenshot' && <ScreenshotSection />}
                    {section.id === 'autodelete' && <AutoDeleteSection />}
                    {section.id === 'block' && <BlockReportSection />}
                    {section.id === 'security' && <SecuritySection />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {/* Quick tips */}
        <div className="mt-4 p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-600">Quick Safety Tips</p>
              <ul className="text-xs text-muted-foreground mt-2 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">•</span>
                  <span>Always set a <strong>Safe Page</strong> before meeting someone — panic button is your best friend</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">•</span>
                  <span>Use <strong>Stealth Icon</strong> if you share your phone — the app will look like a calculator</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">•</span>
                  <span>Send <strong>view-once photos</strong> for sensitive content — they can&apos;t be saved or screenshotted easily</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">•</span>
                  <span>Turn on <strong>Not Today</strong> when you don&apos;t want to be seen — it hides your profile for 24h</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">•</span>
                  <span><strong>Block + Report</strong> anyone who makes you uncomfortable — 5 reports = auto-ban</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ============================================
// SECTION COMPONENTS
// ============================================

function FeatureCard({
  icon,
  title,
  description,
  howToAccess,
  color = 'text-primary',
}: {
  icon: React.ReactNode
  title: string
  description: string
  howToAccess: string
  color?: string
}) {
  return (
    <div className="p-3 rounded-xl bg-secondary/30 border border-border/50 space-y-2">
      <div className="flex items-center gap-2">
        <span className={color}>{icon}</span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      <div className="flex items-start gap-2 pt-1">
        <Eye className="w-3 h-3 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-primary font-medium">{howToAccess}</p>
      </div>
    </div>
  )
}

function EmergencySection() {
  return (
    <div className="space-y-3">
      <FeatureCard
        icon={<Zap className="w-4 h-4" />}
        title="Panic Button"
        description="Instantly leaves the app and opens a safe, normal-looking webpage. No trace of GNECT. Use this when someone suddenly looks at your screen or you feel unsafe."
        howToAccess="Tap the small music note icon (🎵) at the bottom-left corner of the screen"
        color="text-red-500"
      />
      <FeatureCard
        icon={<Music className="w-4 h-4" />}
        title="Triple-Tap Header"
        description="Same as panic button but triggered by tapping the GNECT logo 3 times quickly. Useful when you can't reach the floating button."
        howToAccess="Tap the GNECT text at the top of the screen 3 times fast"
        color="text-red-500"
      />
      <FeatureCard
        icon={<Smartphone className="w-4 h-4" />}
        title="Safe Page (Calculator)"
        description="GNECT has a built-in calculator safe page that looks like a normal calculator app. It's the default safe page. No GNECT branding at all."
        howToAccess="Opens automatically when you hit the panic button (default). Or visit /safe/calculator"
        color="text-red-500"
      />
      <FeatureCard
        icon={<Eye className="w-4 h-4" />}
        title="Choose Your Safe Page"
        description="Pick where the panic button takes you — Calculator (built-in), BBC Sport, Wikipedia, or Weather. All look like normal websites."
        howToAccess="Profile → Privacy → Panic Button Safe Page"
        color="text-red-500"
      />
    </div>
  )
}

function DisguiseSection() {
  return (
    <div className="space-y-3">
      <FeatureCard
        icon={<Smartphone className="w-4 h-4" />}
        title="Stealth App Icon"
        description="Changes the app name and icon on your home screen from GNECT to Calculator. Anyone looking at your phone sees a calculator app, not GNECT. You need to reinstall the PWA after enabling for the change to show."
        howToAccess="Profile → Privacy → Stealth App Icon (toggle)"
        color="text-purple-500"
      />
      <FeatureCard
        icon={<Bell className="w-4 h-4" />}
        title="Discreet Notifications"
        description="Push notifications don't show the app name or any message content. Choose from: 'New activity' (default), 'Weather update', 'News alert', or 'Delivery update'. Anyone glancing at your phone sees nothing identifying."
        howToAccess="Profile → Privacy → Discreet Notifications"
        color="text-purple-500"
      />
      <FeatureCard
        icon={<EyeOff className="w-4 h-4" />}
        title="Disappear Mode"
        description="Hides all chat message content in the chat list. Instead of showing the last message, it shows 'Tap to view'. The GNECT header also shows a yellow 'Disappear' indicator when active."
        howToAccess="Profile → Privacy → Disappear Mode (toggle)"
        color="text-purple-500"
      />
      <FeatureCard
        icon={<EyeOff className="w-4 h-4" />}
        title="Discretion Mode"
        description="Blurs all face photos by default in Discover and Spotlight. Others must tap and hold to temporarily reveal the photo. Protects your identity from shoulder surfers."
        howToAccess="Profile → Privacy → Discretion Mode (toggle)"
        color="text-purple-500"
      />
    </div>
  )
}

function ChatPrivacySection() {
  return (
    <div className="space-y-3">
      <FeatureCard
        icon={<Camera className="w-4 h-4" />}
        title="View-Once Photos"
        description="Send photos that self-destruct after viewing. The other person sees a blurred preview, taps to view, then a 5 or 10 second countdown starts. After that — gone forever. Your nickname is watermarked on the photo to deter screenshots."
        howToAccess="In any chat → tap the camera icon → choose 'View Once (5s)' or 'View Once (10s)'"
        color="text-primary"
      />
      <FeatureCard
        icon={<Trash2 className="w-4 h-4" />}
        title="Ghost Delete"
        description="Delete a message for YOU only. The other person still sees it. Perfect for removing something from your chat history without alerting them."
        howToAccess="In chat → long-press a message → 'Delete for me'"
        color="text-primary"
      />
      <FeatureCard
        icon={<Trash2 className="w-4 h-4" />}
        title="Unsend"
        description="Delete a message for BOTH sides. It disappears from both your chat and their chat completely."
        howToAccess="In chat → long-press a message → 'Unsend'"
        color="text-primary"
      />
      <FeatureCard
        icon={<Clock className="w-4 h-4" />}
        title="Self-Destruct Timer"
        description="Set a timer on any chat — all messages in that chat will auto-delete after the set time. Options: Off, 1 hour, 3 hours, 6 hours, 24 hours. The timer applies to ALL messages in the chat, past and future."
        howToAccess="In any chat → tap the clock icon (⏱) in the top-right of the chat header"
        color="text-primary"
      />
      <FeatureCard
        icon={<Lock className="w-4 h-4" />}
        title="Secret Phrase"
        description="Set a secret phrase that others must type to unlock your locked photos. Protects your private photos from random viewers."
        howToAccess="Profile → Privacy → Secret Phrase"
        color="text-primary"
      />
      <FeatureCard
        icon={<EyeOff className="w-4 h-4" />}
        title="Locked Photos"
        description="Mark certain photos as 'Locked' — others need your secret phrase to view them. Face photos can also be blurred by Discretion Mode."
        howToAccess="Profile → Photos → upload a photo → tap the lock badge to lock it"
        color="text-primary"
      />
    </div>
  )
}

function ScreenshotSection() {
  return (
    <div className="space-y-3">
      <FeatureCard
        icon={<EyeOff className="w-4 h-4" />}
        title="Blur on App Switch"
        description="When you switch away from GNECT (to another app, recent apps, home screen), the entire app blurs. Anyone looking at your recent apps sees a blur, not GNECT content."
        howToAccess="Always active — works automatically when you leave the app"
        color="text-orange-500"
      />
      <FeatureCard
        icon={<Camera className="w-4 h-4" />}
        title="PrintScreen Detection"
        description="If someone presses the PrintScreen key (desktop), a red flash covers the screen saying 'Screenshot blocked'. It can't actually prevent the screenshot, but it deters and alerts."
        howToAccess="Always active — detects PrintScreen key automatically"
        color="text-orange-500"
      />
      <FeatureCard
        icon={<AlertTriangle className="w-4 h-4" />}
        title="Screenshot Alert"
        description="If someone takes a screenshot while viewing your chat, you get a notification saying 'Screenshot detected in a chat'. You'll know your content might have been captured."
        howToAccess="Automatic — you receive an in-app notification if a screenshot is detected"
        color="text-orange-500"
      />
      <FeatureCard
        icon={<EyeOff className="w-4 h-4" />}
        title="View-Once Watermark"
        description="View-once photos display the viewer's nickname as a faint watermark. This discourages taking photos of the screen because the watermark identifies who was viewing."
        howToAccess="Always active on view-once photos — automatic watermark"
        color="text-orange-500"
      />
      <FeatureCard
        icon={<Ban className="w-4 h-4" />}
        title="No Right-Click on Images"
        description="Right-clicking on any image is disabled to prevent saving photos. This works on desktop browsers."
        howToAccess="Always active — right-click on images is blocked"
        color="text-orange-500"
      />
      <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10">
        <p className="text-xs text-orange-600/80">
          ⚠️ <strong>Important:</strong> Web apps cannot fully prevent screenshots on mobile devices. 
          These features are deterrents — they make it harder and riskier, but not impossible. 
          Always use view-once for sensitive content.
        </p>
      </div>
    </div>
  )
}

function AutoDeleteSection() {
  return (
    <div className="space-y-3">
      <div className="p-3 rounded-xl bg-secondary/30 border border-border/50">
        <p className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />
          Auto-Delete Schedule
        </p>
        <div className="space-y-2">
          {[
            { label: 'View-once photos', time: '5 or 10 seconds after opening', icon: '📸' },
            { label: 'Unopened photos', time: '30 minutes', icon: '📷' },
            { label: 'Opened photos', time: '24 hours', icon: '🖼️' },
            { label: 'Text messages', time: '7 days', icon: '💬' },
            { label: 'Hard limit (everything)', time: '7 days maximum', icon: '🗑️' },
            { label: 'Community posts', time: '7 days', icon: '📝' },
            { label: 'Quick Status', time: 'You choose (1h to 24h)', icon: '💬' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-background/50">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <span>{item.icon}</span>
                {item.label}
              </span>
              <span className="text-xs text-muted-foreground">{item.time}</span>
            </div>
          ))}
        </div>
      </div>

      <FeatureCard
        icon={<Clock className="w-4 h-4" />}
        title="Self-Destruct Timer"
        description="Set a per-chat self-destruct timer that overrides the default. All messages in that chat will be deleted after the set time, regardless of the normal auto-delete schedule."
        howToAccess="In any chat → tap the clock icon (⏱) in the chat header"
        color="text-blue-500"
      />

      <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
        <p className="text-xs text-blue-600/80">
          💡 <strong>Tip:</strong> All messages are automatically deleted after 7 days maximum. 
          Even if you don't set a self-destruct timer, your chat history stays clean. 
          Photos disappear even faster — 30 minutes if unopened, 24 hours if opened.
        </p>
      </div>
    </div>
  )
}

function BlockReportSection() {
  return (
    <div className="space-y-3">
      <FeatureCard
        icon={<Ban className="w-4 h-4" />}
        title="Block User"
        description="Block someone and they become invisible to you, AND you become invisible to them. They won't see you in Discover, and you won't see them. Existing chats are hidden."
        howToAccess="Spotlight profile → tap shield icon → Block"
        color="text-destructive"
      />
      <FeatureCard
        icon={<AlertTriangle className="w-4 h-4" />}
        title="Report User"
        description="Report someone with a reason (Fake, Spam, Underage, Harassment). Reporting also blocks them automatically. After 5 reports from different users, the account is auto-banned."
        howToAccess="Spotlight profile → tap shield icon → Report → choose reason"
        color="text-destructive"
      />
      <FeatureCard
        icon={<MessageCircle className="w-4 h-4" />}
        title="Block from Chat"
        description="You can also block or report someone directly from the chat screen without going to their profile."
        howToAccess="In any chat → tap the chat header → Block / Report"
        color="text-destructive"
      />
      <FeatureCard
        icon={<AlertTriangle className="w-4 h-4" />}
        title="Report Posts"
        description="Report community posts that violate rules. Reasons: Spam, Harassment, Underage, Illegal, Other."
        howToAccess="Community → any post → tap the three dots → Report"
        color="text-destructive"
      />
    </div>
  )
}

function SecuritySection() {
  return (
    <div className="space-y-3">
      <FeatureCard
        icon={<EyeOff className="w-4 h-4" />}
        title="Not Today"
        description="Instantly hide your profile from Discover for 24 hours. Nobody can find you. Use it when you're not looking or need a break. Your profile comes back automatically after 24 hours."
        howToAccess="Profile → Privacy → Not Today (toggle)"
        color="text-emerald-500"
      />
      <FeatureCard
        icon={<Smartphone className="w-4 h-4" />}
        title="Session Manager"
        description="See your current device and browser info. Use 'Logout Everywhere' to end all sessions on all devices. Good if you logged in on someone else's phone."
        howToAccess="Profile → Account → Session Manager"
        color="text-emerald-500"
      />
      <FeatureCard
        icon={<Ban className="w-4 h-4" />}
        title="Link Blocking"
        description="All URLs and links are automatically blocked in chat, community posts, and comments. This protects you from phishing, spam, and doxxing attempts."
        howToAccess="Always active — links are blocked automatically everywhere"
        color="text-emerald-500"
      />
      <FeatureCard
        icon={<Trash2 className="w-4 h-4" />}
        title="Delete Chat"
        description="Delete an entire chat conversation from both sides. No trace left for either person."
        howToAccess="In any chat → tap the chat header → Delete Chat"
        color="text-emerald-500"
      />
      <FeatureCard
        icon={<Bell className="w-4 h-4" />}
        title="Quiet Hours"
        description="Set a Do Not Disturb window for push notifications. During quiet hours, notifications are queued and delivered when the window ends."
        howToAccess="Notification bell → Settings → Quiet Hours"
        color="text-emerald-500"
      />
    </div>
  )
}
