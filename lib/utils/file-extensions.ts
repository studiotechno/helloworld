// Extension to color mapping for code citations
// Maps file extensions to Tailwind CSS classes for consistent coloring

const EXTENSION_COLORS: Record<string, string> = {
  // TypeScript/JavaScript
  ts: 'bg-blue-500/20 text-blue-400',
  tsx: 'bg-blue-500/20 text-blue-400',
  js: 'bg-yellow-500/20 text-yellow-400',
  jsx: 'bg-yellow-500/20 text-yellow-400',
  mjs: 'bg-yellow-500/20 text-yellow-400',
  cjs: 'bg-yellow-500/20 text-yellow-400',

  // Python
  py: 'bg-green-500/20 text-green-400',

  // Styles
  css: 'bg-purple-500/20 text-purple-400',
  scss: 'bg-purple-500/20 text-purple-400',
  sass: 'bg-purple-500/20 text-purple-400',
  less: 'bg-purple-500/20 text-purple-400',

  // Config/Data
  json: 'bg-orange-500/20 text-orange-400',
  yaml: 'bg-orange-500/20 text-orange-400',
  yml: 'bg-orange-500/20 text-orange-400',
  toml: 'bg-orange-500/20 text-orange-400',

  // Markup/Docs
  md: 'bg-gray-500/20 text-gray-400',
  mdx: 'bg-gray-500/20 text-gray-400',
  html: 'bg-red-500/20 text-red-400',
  xml: 'bg-red-500/20 text-red-400',

  // Shell
  sh: 'bg-emerald-500/20 text-emerald-400',
  bash: 'bg-emerald-500/20 text-emerald-400',
  zsh: 'bg-emerald-500/20 text-emerald-400',

  // Other
  sql: 'bg-cyan-500/20 text-cyan-400',
  prisma: 'bg-indigo-500/20 text-indigo-400',

  // Default
  default: 'bg-gray-500/20 text-gray-400',
}

/**
 * Get the Tailwind CSS classes for a file extension
 * @param extension - File extension without the dot (e.g., "ts", "tsx")
 * @returns Tailwind CSS classes for background and text color
 */
export function getExtensionColor(extension?: string): string {
  if (!extension) return EXTENSION_COLORS.default
  const normalized = extension.toLowerCase().replace(/^\./, '')
  return EXTENSION_COLORS[normalized] || EXTENSION_COLORS.default
}

/**
 * Extract the extension from a file path
 * @param path - File path (e.g., "src/auth.ts")
 * @returns Extension without the dot (e.g., "ts") or undefined
 */
export function extractExtension(path: string): string | undefined {
  const match = path.match(/\.([a-zA-Z0-9]+)$/)
  return match ? match[1] : undefined
}
