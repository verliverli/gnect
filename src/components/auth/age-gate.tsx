'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface AgeGateProps {
  onConfirm: () => void
}

export function AgeGate({ onConfirm }: AgeGateProps) {
  const [underage, setUnderage] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="min-h-screen flex flex-col items-center justify-center bg-background px-4"
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, delay: 0.05 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl font-bold text-primary tracking-tight">GNECT</h1>
        <p className="text-muted-foreground mt-2 text-sm">No dating. No relationships.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, delay: 0.1 }}
      >
        <Card className="w-full max-w-sm border-border/50 bg-card">
          <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-7 w-7 text-primary" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Are you 18 or older?
              </h2>
              <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed">
                This app contains adult content. You must be 18+ to use GNECT.
              </p>
            </div>

            {underage ? (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 w-full">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-destructive text-sm font-medium">
                  Sorry, you cannot use GNECT.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 w-full mt-1">
                <Button
                  size="lg"
                  className="w-full h-12 text-base font-semibold gnect-transition"
                  onClick={onConfirm}
                >
                  I am 18+
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground text-sm gnect-transition"
                  onClick={() => setUnderage(true)}
                >
                  I am under 18
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <p className="text-muted-foreground/50 text-xs mt-8">
        By continuing, you confirm you are of legal age.
      </p>
    </motion.div>
  )
}
