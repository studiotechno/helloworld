import { Suspense } from 'react'
import { LoginButton } from '@/components/auth/LoginButton'
import { LoginError } from '@/components/auth/LoginError'

export const metadata = {
  title: 'Connexion - Techno',
  description: 'Connectez-vous avec GitHub pour accéder à Techno',
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
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            <span className="text-primary">Techno</span>
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
