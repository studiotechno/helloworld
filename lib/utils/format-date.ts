// Date formatting utilities

/**
 * Format a date to ISO 8601 string for JSON responses
 */
export function toISOString(date: Date): string {
  return date.toISOString()
}

/**
 * Format a date to a human-readable relative time string
 * e.g., "il y a 2 heures", "hier", "la semaine derniere"
 */
export function formatRelative(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) {
    return "à l'instant"
  }
  if (diffMin < 60) {
    return `il y a ${diffMin} minute${diffMin > 1 ? 's' : ''}`
  }
  if (diffHour < 24) {
    return `il y a ${diffHour} heure${diffHour > 1 ? 's' : ''}`
  }
  if (diffDay === 1) {
    return 'hier'
  }
  if (diffDay < 7) {
    return `il y a ${diffDay} jours`
  }
  if (diffDay < 30) {
    const weeks = Math.floor(diffDay / 7)
    return `il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`
  }

  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Group dates into categories for conversation list
 */
export function getDateGroup(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDay === 0) return "Aujourd'hui"
  if (diffDay === 1) return 'Hier'
  if (diffDay < 7) return 'Cette semaine'
  if (diffDay < 30) return 'Ce mois'
  return 'Plus ancien'
}
