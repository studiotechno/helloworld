import { redirect } from 'next/navigation'
import { syncUser } from '@/lib/auth/sync-user'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  // First check if user is authenticated via Supabase
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  // If not authenticated, redirect to login
  if (!authUser) {
    redirect('/login')
  }

  // Sync user with Prisma
  await syncUser()

  // Redirect to chat (new conversation)
  redirect('/chat')
}
