# Phare

Éclairez votre code avec l'IA. Analysez votre codebase pour comprendre les fonctionnalités, évaluer l'impact des changements et identifier la dette technique.

## Tech Stack

- **Framework**: Next.js 15+ with App Router
- **Language**: TypeScript (strict mode)
- **Database**: Supabase PostgreSQL
- **ORM**: Prisma
- **Authentication**: Supabase Auth (GitHub OAuth)
- **AI**: Anthropic Claude via Vercel AI SDK
- **UI**: shadcn/ui + Tailwind CSS
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 20.9+
- npm or pnpm
- Supabase account
- Anthropic API key
- GitHub OAuth app (configured in Supabase)

### Environment Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in the required environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
   - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
   - `DATABASE_URL` - Supabase PostgreSQL connection string (with pooling)
   - `DIRECT_URL` - Direct PostgreSQL connection (for migrations)
   - `ANTHROPIC_API_KEY` - Your Anthropic API key

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run development server with Turbopack
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Database Setup

```bash
# Push schema to database
npm run db:push

# Open Prisma Studio (database GUI)
npm run db:studio
```

## Project Structure

```
├── app/                  # Next.js App Router
│   ├── (auth)/          # Authentication routes
│   ├── (dashboard)/     # Protected dashboard routes
│   ├── (marketing)/     # Public marketing pages
│   └── api/             # API routes
├── components/          # React components
│   ├── ui/             # shadcn/ui components
│   ├── chat/           # Chat interface components
│   ├── layout/         # Layout components
│   └── shared/         # Shared components
├── lib/                 # Utilities and clients
│   ├── supabase/       # Supabase clients
│   ├── ai/             # AI SDK configuration
│   ├── github/         # GitHub API client
│   └── validators/     # Zod schemas
├── providers/           # React context providers
├── hooks/               # Custom React hooks
├── types/               # TypeScript type definitions
└── prisma/              # Database schema
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Manual Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:studio` - Open Prisma Studio

## License

Private - All rights reserved
