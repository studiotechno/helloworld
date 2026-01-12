/**
 * Indexing Module
 *
 * Exports for code indexation functionality.
 */

// Job Management
export {
  startIndexingJob,
  getJobStatus,
  getJobByRepository,
  updateJobProgress,
  updateJobStatus,
  markJobStarted,
  markJobCompleted,
  markJobFailed,
  cancelJob,
  deleteJob,
  isJobTerminal,
  isJobInProgress,
  calculateProgress,
  getJobsForUser,
  getInProgressJobs,
  cleanupStaleJobs,
  type JobStatus,
  type JobPhase,
  type IndexingJob,
  type JobProgress,
  type StartJobResult,
} from './job-manager'

// Pipeline
export {
  runIndexationPipeline,
  runIncrementalIndexation,
  deleteRepositoryChunks,
  getRepositoryIndexStats,
  isRepositoryIndexed,
  type PipelineOptions,
  type PipelineResult,
  type ChunkWithEmbedding,
} from './pipeline'

// Contextual Generator
export {
  generateChunkContext,
  generateContextsBatch,
  buildContextualContent,
  estimateContextGenerationCost,
  type ChunkForContext,
  type FileContext,
} from './contextual-generator'
