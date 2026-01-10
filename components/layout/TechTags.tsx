'use client'

import { cn } from '@/lib/utils'

interface TechTagsProps {
  technologies: string[]
  maxVisible?: number
  className?: string
}

// Color mapping by technology/category
const techColors: Record<string, string> = {
  // Frontend
  TypeScript: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  JavaScript: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  React: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  Vue: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Angular: 'bg-red-500/20 text-red-400 border-red-500/30',
  Svelte: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  HTML: 'bg-orange-600/20 text-orange-300 border-orange-600/30',
  CSS: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',

  // Backend
  Python: 'bg-green-500/20 text-green-400 border-green-500/30',
  Go: 'bg-cyan-600/20 text-cyan-300 border-cyan-600/30',
  Rust: 'bg-orange-700/20 text-orange-300 border-orange-700/30',
  Java: 'bg-red-600/20 text-red-300 border-red-600/30',
  Ruby: 'bg-red-500/20 text-red-400 border-red-500/30',
  PHP: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'C#': 'bg-purple-600/20 text-purple-300 border-purple-600/30',
  C: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  'C++': 'bg-pink-600/20 text-pink-300 border-pink-600/30',

  // Mobile
  Swift: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Kotlin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Dart: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',

  // Shell/Scripts
  Shell: 'bg-green-600/20 text-green-300 border-green-600/30',
  PowerShell: 'bg-blue-600/20 text-blue-300 border-blue-600/30',

  // Data
  SQL: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  R: 'bg-blue-400/20 text-blue-300 border-blue-400/30',
}

const defaultColor = 'bg-gray-500/20 text-gray-400 border-gray-500/30'

export function TechTags({
  technologies,
  maxVisible = 3,
  className,
}: TechTagsProps) {
  if (!technologies || technologies.length === 0) {
    return null
  }

  const visibleTechs = technologies.slice(0, maxVisible)
  const hiddenCount = technologies.length - maxVisible

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {visibleTechs.map((tech) => (
        <span
          key={tech}
          className={cn(
            'inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium',
            techColors[tech] || defaultColor
          )}
        >
          {tech}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="inline-flex items-center rounded-md border border-border/50 bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground">
          +{hiddenCount}
        </span>
      )}
    </div>
  )
}
