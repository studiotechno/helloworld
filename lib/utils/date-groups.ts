/**
 * Date grouping utilities for conversation list
 */

export type DateGroup = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'older'

export const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  today: "Aujourd'hui",
  yesterday: 'Hier',
  thisWeek: 'Cette semaine',
  thisMonth: 'Ce mois',
  older: 'Plus ancien',
}

export const DATE_GROUP_ORDER: DateGroup[] = [
  'today',
  'yesterday',
  'thisWeek',
  'thisMonth',
  'older',
]

/**
 * Get the start of a day (midnight) for a given date
 */
function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get the start of the week (Monday) for a given date
 */
function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get the start of the month for a given date
 */
function startOfMonth(date: Date): Date {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Determine which date group a date belongs to
 */
export function getDateGroup(date: Date | string): DateGroup {
  const d = new Date(date)
  const now = new Date()

  const todayStart = startOfDay(now)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const weekStart = startOfWeek(now)
  const monthStart = startOfMonth(now)

  const dateStart = startOfDay(d)

  if (dateStart.getTime() >= todayStart.getTime()) {
    return 'today'
  }
  if (dateStart.getTime() >= yesterdayStart.getTime()) {
    return 'yesterday'
  }
  if (dateStart.getTime() >= weekStart.getTime()) {
    return 'thisWeek'
  }
  if (dateStart.getTime() >= monthStart.getTime()) {
    return 'thisMonth'
  }
  return 'older'
}

/**
 * Group conversations by date, maintaining order within groups
 */
export function groupConversationsByDate<T extends { updated_at: string }>(
  conversations: T[]
): Map<DateGroup, T[]> {
  const groups = new Map<DateGroup, T[]>()

  // Initialize groups in order
  for (const group of DATE_GROUP_ORDER) {
    groups.set(group, [])
  }

  // Sort conversations by updated_at descending (most recent first)
  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )

  // Group each conversation
  for (const conversation of sorted) {
    const group = getDateGroup(conversation.updated_at)
    groups.get(group)!.push(conversation)
  }

  return groups
}

/**
 * Get emoji for a conversation based on its title
 */
export function getConversationEmoji(title: string | null): string {
  const titleLower = (title || '').toLowerCase()

  if (titleLower.includes('bug') || titleLower.includes('error') || titleLower.includes('erreur')) {
    return '🐛'
  }
  if (titleLower.includes('test')) {
    return '🧪'
  }
  if (titleLower.includes('database') || titleLower.includes('db') || titleLower.includes('base de donnees')) {
    return '🗄️'
  }
  if (titleLower.includes('api') || titleLower.includes('endpoint')) {
    return '🔌'
  }
  if (titleLower.includes('security') || titleLower.includes('securite') || titleLower.includes('auth')) {
    return '🔒'
  }
  if (titleLower.includes('performance') || titleLower.includes('optimis')) {
    return '⚡'
  }
  if (titleLower.includes('refactor')) {
    return '🔧'
  }
  if (titleLower.includes('feature') || titleLower.includes('fonctionnalite')) {
    return '✨'
  }
  if (titleLower.includes('doc')) {
    return '📝'
  }
  if (titleLower.includes('deploy') || titleLower.includes('ci') || titleLower.includes('cd')) {
    return '🚀'
  }

  return '💬'
}
