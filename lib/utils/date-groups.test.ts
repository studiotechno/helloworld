import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getDateGroup,
  groupConversationsByDate,
  getConversationEmoji,
  DATE_GROUP_LABELS,
  DATE_GROUP_ORDER,
} from './date-groups'

describe('date-groups', () => {
  describe('getDateGroup', () => {
    beforeEach(() => {
      // Mock current date to 2026-01-10 15:00:00 (Saturday)
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-10T15:00:00'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns "today" for dates from today', () => {
      expect(getDateGroup('2026-01-10T00:00:00')).toBe('today')
      expect(getDateGroup('2026-01-10T10:30:00')).toBe('today')
      expect(getDateGroup('2026-01-10T23:59:59')).toBe('today')
      expect(getDateGroup(new Date('2026-01-10T12:00:00'))).toBe('today')
    })

    it('returns "yesterday" for dates from yesterday', () => {
      expect(getDateGroup('2026-01-09T00:00:00')).toBe('yesterday')
      expect(getDateGroup('2026-01-09T12:00:00')).toBe('yesterday')
      expect(getDateGroup('2026-01-09T23:59:59')).toBe('yesterday')
    })

    it('returns "thisWeek" for dates from this week (excluding today/yesterday)', () => {
      // 2026-01-10 is Saturday, week starts Monday 2026-01-05
      expect(getDateGroup('2026-01-08T12:00:00')).toBe('thisWeek') // Thursday
      expect(getDateGroup('2026-01-07T12:00:00')).toBe('thisWeek') // Wednesday
      expect(getDateGroup('2026-01-06T12:00:00')).toBe('thisWeek') // Tuesday
      expect(getDateGroup('2026-01-05T12:00:00')).toBe('thisWeek') // Monday
    })

    it('returns "thisMonth" for dates from this month (excluding this week)', () => {
      // 2026-01-10 is Saturday, week starts Monday 2026-01-05
      expect(getDateGroup('2026-01-04T12:00:00')).toBe('thisMonth') // Sunday before week start
      expect(getDateGroup('2026-01-01T12:00:00')).toBe('thisMonth') // First of month
    })

    it('returns "older" for dates from previous months', () => {
      expect(getDateGroup('2025-12-31T23:59:59')).toBe('older')
      expect(getDateGroup('2025-12-01T12:00:00')).toBe('older')
      expect(getDateGroup('2024-06-15T12:00:00')).toBe('older')
    })

    it('handles string dates', () => {
      expect(getDateGroup('2026-01-10T10:00:00Z')).toBe('today')
    })

    it('handles Date objects', () => {
      expect(getDateGroup(new Date('2026-01-10T10:00:00'))).toBe('today')
    })
  })

  describe('groupConversationsByDate', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-10T15:00:00'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('groups conversations by date', () => {
      const conversations = [
        { id: '1', updated_at: '2026-01-10T10:00:00' }, // today
        { id: '2', updated_at: '2026-01-09T10:00:00' }, // yesterday
        { id: '3', updated_at: '2026-01-10T08:00:00' }, // today
        { id: '4', updated_at: '2025-12-01T10:00:00' }, // older
      ]

      const grouped = groupConversationsByDate(conversations)

      expect(grouped.get('today')).toHaveLength(2)
      expect(grouped.get('yesterday')).toHaveLength(1)
      expect(grouped.get('older')).toHaveLength(1)
    })

    it('sorts conversations within groups by updated_at descending', () => {
      const conversations = [
        { id: '1', updated_at: '2026-01-10T08:00:00' },
        { id: '2', updated_at: '2026-01-10T12:00:00' },
        { id: '3', updated_at: '2026-01-10T10:00:00' },
      ]

      const grouped = groupConversationsByDate(conversations)
      const todayGroup = grouped.get('today')!

      expect(todayGroup[0].id).toBe('2') // most recent first
      expect(todayGroup[1].id).toBe('3')
      expect(todayGroup[2].id).toBe('1')
    })

    it('initializes all groups even if empty', () => {
      const conversations: { updated_at: string }[] = []
      const grouped = groupConversationsByDate(conversations)

      expect(grouped.has('today')).toBe(true)
      expect(grouped.has('yesterday')).toBe(true)
      expect(grouped.has('thisWeek')).toBe(true)
      expect(grouped.has('thisMonth')).toBe(true)
      expect(grouped.has('older')).toBe(true)
    })

    it('maintains group order', () => {
      const conversations = [
        { id: '1', updated_at: '2025-12-01T10:00:00' }, // older
        { id: '2', updated_at: '2026-01-10T10:00:00' }, // today
      ]

      const grouped = groupConversationsByDate(conversations)
      const keys = Array.from(grouped.keys())

      expect(keys).toEqual(DATE_GROUP_ORDER)
    })
  })

  describe('getConversationEmoji', () => {
    it('returns bug emoji for bug-related titles', () => {
      expect(getConversationEmoji('Fix bug in login')).toBe('🐛')
      expect(getConversationEmoji('Error handling')).toBe('🐛')
      expect(getConversationEmoji('Erreur de connexion')).toBe('🐛')
    })

    it('returns test emoji for test-related titles', () => {
      expect(getConversationEmoji('Add unit tests')).toBe('🧪')
      expect(getConversationEmoji('Testing strategy')).toBe('🧪')
    })

    it('returns database emoji for database-related titles', () => {
      expect(getConversationEmoji('Database migration')).toBe('🗄️')
      expect(getConversationEmoji('DB schema update')).toBe('🗄️')
      expect(getConversationEmoji('Base de donnees')).toBe('🗄️')
    })

    it('returns API emoji for API-related titles', () => {
      expect(getConversationEmoji('API endpoint')).toBe('🔌')
      expect(getConversationEmoji('REST API design')).toBe('🔌')
    })

    it('returns security emoji for security-related titles', () => {
      expect(getConversationEmoji('Security audit')).toBe('🔒')
      expect(getConversationEmoji('Auth flow')).toBe('🔒')
      expect(getConversationEmoji('Securite')).toBe('🔒')
    })

    it('returns performance emoji for performance-related titles', () => {
      expect(getConversationEmoji('Performance optimization')).toBe('⚡')
      expect(getConversationEmoji('Optimiser les requetes')).toBe('⚡')
    })

    it('returns wrench emoji for refactor-related titles', () => {
      expect(getConversationEmoji('Refactor component')).toBe('🔧')
    })

    it('returns sparkle emoji for feature-related titles', () => {
      expect(getConversationEmoji('New feature')).toBe('✨')
      expect(getConversationEmoji('Nouvelle fonctionnalite')).toBe('✨')
    })

    it('returns doc emoji for documentation-related titles', () => {
      expect(getConversationEmoji('Update docs')).toBe('📝')
      expect(getConversationEmoji('Documentation')).toBe('📝')
    })

    it('returns rocket emoji for deployment-related titles', () => {
      expect(getConversationEmoji('Deploy to production')).toBe('🚀')
      expect(getConversationEmoji('CI/CD pipeline')).toBe('🚀')
    })

    it('returns default chat emoji for unmatched titles', () => {
      expect(getConversationEmoji('Random question')).toBe('💬')
      expect(getConversationEmoji('Hello world')).toBe('💬')
      expect(getConversationEmoji(null)).toBe('💬')
      expect(getConversationEmoji('')).toBe('💬')
    })
  })

  describe('DATE_GROUP_LABELS', () => {
    it('has French labels for all groups', () => {
      expect(DATE_GROUP_LABELS.today).toBe("Aujourd'hui")
      expect(DATE_GROUP_LABELS.yesterday).toBe('Hier')
      expect(DATE_GROUP_LABELS.thisWeek).toBe('Cette semaine')
      expect(DATE_GROUP_LABELS.thisMonth).toBe('Ce mois')
      expect(DATE_GROUP_LABELS.older).toBe('Plus ancien')
    })
  })
})
