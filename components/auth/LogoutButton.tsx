'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut, Loader2 } from 'lucide-react'

interface LogoutButtonProps {
  variant?: 'default' | 'ghost' | 'destructive' | 'outline' | 'secondary' | 'link'
  showIcon?: boolean
  showText?: boolean
  className?: string
}

export function LogoutButton({
  variant = 'ghost',
  showIcon = true,
  showText = true,
  className,
}: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('[Auth] Logout error:', error)
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      onClick={handleLogout}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        showIcon && <LogOut className="size-4" />
      )}
      {showText && (
        <span className={showIcon ? 'ml-2' : ''}>
          {isLoading ? 'Déconnexion...' : 'Se déconnecter'}
        </span>
      )}
    </Button>
  )
}
