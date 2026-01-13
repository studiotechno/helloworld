/**
 * Structured Logger for Production
 *
 * Provides consistent logging with:
 * - Log levels (debug, info, warn, error)
 * - Structured context (JSON in production)
 * - Environment-aware output (pretty in dev, JSON in prod)
 * - Namespace support for filtering
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  level: LogLevel
  namespace: string
  message: string
  timestamp: string
  context?: LogContext
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// Minimum log level based on environment
const MIN_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug'
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

/**
 * Format log entry for output
 */
function formatEntry(entry: LogEntry): string {
  if (IS_PRODUCTION) {
    // JSON format for production (easier to parse in log aggregators)
    return JSON.stringify(entry)
  }

  // Pretty format for development
  const levelColors: Record<LogLevel, string> = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m',  // green
    warn: '\x1b[33m',  // yellow
    error: '\x1b[31m', // red
  }
  const reset = '\x1b[0m'
  const dim = '\x1b[2m'

  const color = levelColors[entry.level]
  const levelStr = entry.level.toUpperCase().padEnd(5)
  const contextStr = entry.context
    ? ` ${dim}${JSON.stringify(entry.context)}${reset}`
    : ''

  return `${dim}${entry.timestamp}${reset} ${color}${levelStr}${reset} [${entry.namespace}] ${entry.message}${contextStr}`
}

/**
 * Output log entry to console
 */
function output(entry: LogEntry): void {
  const formatted = formatEntry(entry)

  switch (entry.level) {
    case 'error':
      console.error(formatted)
      break
    case 'warn':
      console.warn(formatted)
      break
    default:
      console.log(formatted)
  }
}

/**
 * Check if log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL]
}

/**
 * Create a namespaced logger
 */
export function createLogger(namespace: string) {
  const log = (level: LogLevel, message: string, context?: LogContext): void => {
    if (!shouldLog(level)) return

    const entry: LogEntry = {
      level,
      namespace,
      message,
      timestamp: new Date().toISOString(),
      ...(context && { context }),
    }

    output(entry)
  }

  return {
    debug: (message: string, context?: LogContext) => log('debug', message, context),
    info: (message: string, context?: LogContext) => log('info', message, context),
    warn: (message: string, context?: LogContext) => log('warn', message, context),
    error: (message: string, context?: LogContext) => log('error', message, context),
  }
}

// Pre-configured loggers for common namespaces
export const logger = {
  api: createLogger('API'),
  indexing: createLogger('Indexing'),
  github: createLogger('GitHub'),
  ai: createLogger('AI'),
  db: createLogger('DB'),
  auth: createLogger('Auth'),
}

export type Logger = ReturnType<typeof createLogger>
