import { Suspense } from 'react'
import { LoginButton } from '@/components/auth/LoginButton'
import { LoginError } from '@/components/auth/LoginError'

export const metadata = {
  title: 'Connexion - Phare',
  description: 'Connectez-vous avec GitHub pour accéder à Phare',
}

function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string; redirectTo?: string }>
}) {
  return (
    <LoginPageContent searchParams={searchParams} />
  )
}

async function LoginPageContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string; redirectTo?: string }>
}) {
  const params = await searchParams
  const error = params.error
  const errorDescription = params.error_description
  const redirectTo = params.redirectTo

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
            <svg className="size-9 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="5" fill="currentColor" />
              <line x1="12" y1="1" x2="12" y2="5" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
              <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
              <line x1="1" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
              <line x1="19" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
              <line x1="4.2" y1="4.2" x2="7" y2="7" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
              <line x1="17" y1="17" x2="19.8" y2="19.8" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
              <line x1="4.2" y1="19.8" x2="7" y2="17" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
              <line x1="17" y1="7" x2="19.8" y2="4.2" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            <span className="text-primary">Phare</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            Discutez avec votre codebase en langage naturel
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <Suspense fallback={null}>
            <LoginError error={error} description={errorDescription} />
          </Suspense>
        )}

        {/* Login Card */}
        <div className="rounded-3xl border border-border/50 bg-card/50 p-8 shadow-xl backdrop-blur-sm">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">
                Bienvenue
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Connectez-vous en 2 clics avec GitHub
              </p>
            </div>

            <div className="flex justify-center">
              <LoginButton redirectTo={redirectTo} />
            </div>

            <p className="text-center text-xs text-muted-foreground">
              En vous connectant, vous acceptez nos conditions d&apos;utilisation
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/60">
          Authentification sécurisée via GitHub OAuth
        </p>
      </div>
    </div>
  )
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string; redirectTo?: string }>
}) {
  return <LoginContent searchParams={searchParams} />
}
