import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/DashboardShell'

export const metadata = {
  title: 'Dashboard - Phare',
  description: 'Votre espace de travail Phare',
}

interface GitHubUserMetadata {
  user_name?: string
  name?: string
  full_name?: string
  avatar_url?: string
  email?: string
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  // If not authenticated, redirect to login
  if (!authUser) {
    redirect('/login')
  }

  // Extract user data from Supabase auth
  const metadata = authUser.user_metadata as GitHubUserMetadata
  const user = {
    name:
      metadata.name ||
      metadata.full_name ||
      metadata.user_name ||
      'Utilisateur',
    email: authUser.email || null,
    avatarUrl: metadata.avatar_url || null,
  }

  return <DashboardShell user={user}>{children}</DashboardShell>
}
