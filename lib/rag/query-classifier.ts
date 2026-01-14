/**
 * Query Classifier for Smart Retrieval
 *
 * Detects the type of query to use the most appropriate retrieval strategy:
 * - Structured queries (endpoints, components, hooks) → metadata-based retrieval
 * - Open queries → vector search
 */

export type QueryType =
  | 'API_ROUTES'
  | 'COMPONENTS'
  | 'HOOKS'
  | 'SCHEMA'
  | 'TESTS'
  | 'TYPES'
  | 'CONFIG'
  | 'EMBEDDINGS'
  | 'INDEXING'
  | 'GENERIC'

interface QueryPattern {
  type: QueryType
  keywords: string[]
  keywordsFr: string[] // French keywords
}

const QUERY_PATTERNS: QueryPattern[] = [
  {
    type: 'API_ROUTES',
    keywords: ['endpoint', 'endpoints', 'api', 'route', 'routes', 'rest', 'http'],
    keywordsFr: ['endpoint', 'endpoints', 'api', 'route', 'routes'],
  },
  {
    type: 'COMPONENTS',
    keywords: ['component', 'components', 'ui', 'widget', 'widgets'],
    keywordsFr: ['composant', 'composants', 'interface'],
  },
  {
    type: 'HOOKS',
    keywords: ['hook', 'hooks', 'usehook', 'custom hook'],
    keywordsFr: ['hook', 'hooks'],
  },
  {
    type: 'SCHEMA',
    keywords: ['schema', 'database', 'db', 'prisma', 'model', 'models', 'table', 'tables'],
    keywordsFr: ['schema', 'base de donnees', 'modele', 'modeles', 'table', 'tables'],
  },
  {
    type: 'TESTS',
    keywords: ['test', 'tests', 'testing', 'spec', 'specs', 'unit test', 'integration test'],
    keywordsFr: ['test', 'tests', 'tester'],
  },
  {
    type: 'TYPES',
    keywords: ['type', 'types', 'interface', 'interfaces', 'typedef', 'typing'],
    keywordsFr: ['type', 'types', 'interface', 'interfaces', 'typage'],
  },
  {
    type: 'CONFIG',
    keywords: [
      'config', 'configuration', 'settings', 'env', 'environment',
      'stack', 'tech stack', 'technology', 'technologies', 'framework', 'frameworks',
      'dependencies', 'package', 'packages', 'library', 'libraries',
      'font', 'fonts', 'typography', 'typeface', 'color', 'colors', 'theme',
      'tailwind', 'css', 'style', 'styles', 'design', 'layout',
    ],
    keywordsFr: [
      'config', 'configuration', 'parametres', 'environnement',
      'stack', 'technique', 'technologie', 'technologies', 'framework', 'frameworks',
      'dependances', 'librairie', 'librairies', 'bibliotheque', 'bibliotheques',
      'police', 'polices', 'typographie', 'typo', 'typos', 'couleur', 'couleurs',
      'theme', 'tailwind', 'css', 'style', 'styles', 'design', 'layout', 'mise en page',
    ],
  },
  {
    type: 'EMBEDDINGS',
    keywords: [
      'embedding', 'embeddings', 'vector', 'vectors', 'vectorization',
      'voyage', 'pgvector', 'pinecone', 'rag', 'retrieval',
      'similarity', 'semantic search', 'chunk', 'chunks',
    ],
    keywordsFr: [
      'embedding', 'embeddings', 'vecteur', 'vecteurs', 'vectorisation',
      'voyage', 'pgvector', 'pinecone', 'rag', 'retrieval',
      'similarite', 'recherche semantique', 'chunk', 'chunks', 'stockage',
    ],
  },
  {
    type: 'INDEXING',
    keywords: [
      'index', 'indexing', 'reindex', 'reindexing', 're-index',
      'pipeline', 'parsing', 'chunking', 'contextual',
      'devstral', 'mistral', 'context generation',
      'webhook', 'trigger', 'github webhook',
    ],
    keywordsFr: [
      'index', 'indexation', 'reindexation', 're-indexation', 'reindexer',
      'pipeline', 'parsing', 'chunking', 'contextuel',
      'devstral', 'mistral', 'generation de contexte',
      'webhook', 'declencheur', 'trigger',
    ],
  },
]

// Keywords that suggest the user wants a comprehensive list or overview
const LIST_INDICATORS = [
  // English
  'all', 'list', 'every', 'available', 'what are', 'show me', 'give me', 'what is the',
  // French
  'tous', 'toutes', 'liste', 'quels', 'quelles', 'disponibles', 'montre', 'donne',
  "c'est quoi", 'quelle est', 'quel est', 'quoi',
]

/**
 * Classify a query to determine the best retrieval strategy
 */
export function classifyQuery(query: string): {
  type: QueryType
  isListQuery: boolean
  confidence: number
} {
  const normalizedQuery = query.toLowerCase().trim()

  // Check if this is a "list all" type query
  const isListQuery = LIST_INDICATORS.some((indicator) =>
    normalizedQuery.includes(indicator)
  )

  // Find matching pattern
  let bestMatch: { type: QueryType; score: number } = { type: 'GENERIC', score: 0 }

  for (const pattern of QUERY_PATTERNS) {
    const allKeywords = [...pattern.keywords, ...pattern.keywordsFr]
    let matchScore = 0

    for (const keyword of allKeywords) {
      if (normalizedQuery.includes(keyword)) {
        // Longer keywords get higher scores (more specific)
        matchScore += keyword.length
      }
    }

    if (matchScore > bestMatch.score) {
      bestMatch = { type: pattern.type, score: matchScore }
    }
  }

  // Calculate confidence (0-1)
  const confidence = Math.min(bestMatch.score / 20, 1)

  return {
    type: bestMatch.type,
    isListQuery,
    confidence,
  }
}

/**
 * Get the SQL filter pattern for a query type
 */
export function getMetadataFilter(queryType: QueryType): {
  filePathPattern?: string
  filePathPatterns?: string[]
  chunkTypes?: string[]
  symbolPattern?: string
} | null {
  switch (queryType) {
    case 'API_ROUTES':
      return {
        filePathPatterns: ['%route.ts', '%route.tsx', '%/api/%'],
      }
    case 'COMPONENTS':
      return {
        filePathPatterns: ['%components%', '%.tsx'],
        chunkTypes: ['function', 'class'],
      }
    case 'HOOKS':
      return {
        filePathPatterns: ['%hooks%', '%use%.ts', '%use%.tsx'],
        symbolPattern: 'use%',
      }
    case 'SCHEMA':
      return {
        filePathPatterns: ['%schema.prisma', '%prisma%', '%models%', '%entities%'],
      }
    case 'TESTS':
      return {
        filePathPatterns: ['%.test.%', '%.spec.%', '%__tests__%'],
      }
    case 'TYPES':
      return {
        filePathPatterns: ['%types%', '%.d.ts'],
        chunkTypes: ['interface', 'type'],
      }
    case 'CONFIG':
      return {
        filePathPatterns: [
          '%config%',
          '%.config.%',
          '%next.config%',
          '%tsconfig%',
          '%package.json',
          '%.env%',
          '%Dockerfile%',
          '%docker-compose%',
          '%.nvmrc',
          '%.node-version',
          '%layout.tsx',
          '%globals.css',
          '%tailwind%',
          '%theme%',
        ],
      }
    case 'EMBEDDINGS':
      return {
        filePathPatterns: [
          '%embeddings%',
          '%voyage%',
          '%vector%',
          '%rag%',
          '%lib/db%',
          '%reranker%',
          '%retrieval%',
        ],
      }
    case 'INDEXING':
      return {
        filePathPatterns: [
          '%indexing%',
          '%pipeline%',
          '%parsing%',
          '%chunker%',
          '%contextual%',
          '%ast-%',
        ],
      }
    case 'GENERIC':
    default:
      return null
  }
}

/**
 * Get a human-readable description of the query type
 */
export function getQueryTypeLabel(queryType: QueryType, lang: 'en' | 'fr' = 'fr'): string {
  const labels: Record<QueryType, { en: string; fr: string }> = {
    API_ROUTES: { en: 'API endpoints', fr: 'endpoints API' },
    COMPONENTS: { en: 'UI components', fr: 'composants UI' },
    HOOKS: { en: 'React hooks', fr: 'hooks React' },
    SCHEMA: { en: 'database schema', fr: 'schema de base de donnees' },
    TESTS: { en: 'tests', fr: 'tests' },
    TYPES: { en: 'type definitions', fr: 'definitions de types' },
    CONFIG: { en: 'configuration files', fr: 'fichiers de configuration' },
    EMBEDDINGS: { en: 'embeddings & RAG', fr: 'embeddings et RAG' },
    INDEXING: { en: 'indexing pipeline', fr: 'pipeline d\'indexation' },
    GENERIC: { en: 'code', fr: 'code' },
  }

  return labels[queryType][lang]
}
