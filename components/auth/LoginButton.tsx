'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Github, Loader2 } from 'lucide-react'

interface LoginButtonProps {
  redirectTo?: string
}

export function LoginButton({ redirectTo }: LoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async () => {
    setIsLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`,
        scopes: 'repo user:email read:org',
      },
    })

    if (error) {
      console.error('OAuth error:', error)
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleLogin}
      disabled={isLoading}
      size="lg"
      className="min-h-[44px] min-w-[200px] rounded-2xl text-base font-semibold shadow-lg transition-all hover:shadow-[var(--glow-pink)] hover:scale-[1.02]"
    >
      {isLoading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <Github className="size-5" />
      )}
      {isLoading ? 'Connexion...' : 'Se connecter avec GitHub'}
    </Button>
  )
}
