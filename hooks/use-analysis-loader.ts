'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { AnalysisPhase } from '@/components/chat/AnalysisLoader'

export interface AnalysisLoaderState {
  phase: 'idle' | AnalysisPhase
  message: string
  filesAnalyzed: number
  foldersAnalyzed: number
  elapsedTime: number
  showLoader: boolean
}

// Phase timing thresholds in seconds
const PHASE_THRESHOLDS = {
  SHOW_LOADER: 2, // Show AnalysisLoader after 2s
  SCANNING: 5, // Start showing file counts after 5s
  PROCESSING: 15, // Show processing message after 15s
  TIMEOUT: 30, // Show timeout warning after 30s
} as const

// Simulated file analysis rate (files per second)
const FILES_PER_SECOND = 50
const MAX_FILES = 847
const FILES_PER_FOLDER = 70
const MAX_FOLDERS = 12

/**
 * Hook to manage analysis loader state based on loading duration
 * Transitions through phases and simulates file analysis progress
 */
export function useAnalysisLoader(isLoading: boolean) {
  const [startTime, setStartTime] = useState<number | null>(null)
  const [state, setState] = useState<AnalysisLoaderState>({
    phase: 'idle',
    message: '',
    filesAnalyzed: 0,
    foldersAnalyzed: 0,
    elapsedTime: 0,
    showLoader: false,
  })

  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Reset state when loading starts or stops
  useEffect(() => {
    if (isLoading && !startTime) {
      setStartTime(Date.now())
    } else if (!isLoading) {
      setStartTime(null)
      setState({
        phase: 'idle',
        message: '',
        filesAnalyzed: 0,
        foldersAnalyzed: 0,
        elapsedTime: 0,
        showLoader: false,
      })
    }
  }, [isLoading, startTime])

  // Update state based on elapsed time
  useEffect(() => {
    if (!startTime) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const updateState = () => {
      const elapsed = (Date.now() - startTime) / 1000

      let phase: AnalysisLoaderState['phase'] = 'idle'
      let message = ''
      let showLoader = false

      if (elapsed < PHASE_THRESHOLDS.SHOW_LOADER) {
        // Use TypingIndicator for first 2 seconds
        phase = 'idle'
      } else if (elapsed < PHASE_THRESHOLDS.SCANNING) {
        phase = 'loading'
        message = 'Analyse en cours...'
        showLoader = true
      } else if (elapsed < PHASE_THRESHOLDS.PROCESSING) {
        phase = 'scanning'
        message = 'Lecture des fichiers...'
        showLoader = true
      } else if (elapsed < PHASE_THRESHOLDS.TIMEOUT) {
        phase = 'processing'
        message = 'Traitement des resultats...'
        showLoader = true
      } else {
        phase = 'timeout'
        message = 'Cette analyse prend plus de temps que prevu...'
        showLoader = true
      }

      // Calculate simulated file progress
      const effectiveTime = Math.max(0, elapsed - PHASE_THRESHOLDS.SHOW_LOADER)
      const filesAnalyzed =
        phase !== 'idle' && phase !== 'loading'
          ? Math.min(Math.floor(effectiveTime * FILES_PER_SECOND), MAX_FILES)
          : 0
      const foldersAnalyzed = Math.min(
        Math.floor(filesAnalyzed / FILES_PER_FOLDER),
        MAX_FOLDERS
      )

      setState({
        phase,
        message,
        filesAnalyzed,
        foldersAnalyzed,
        elapsedTime: elapsed,
        showLoader,
      })
    }

    // Initial update
    updateState()

    // Set up interval for updates
    intervalRef.current = setInterval(updateState, 100)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [startTime])

  // Callback to reset the loader (used on cancel)
  const reset = useCallback(() => {
    setStartTime(null)
    setState({
      phase: 'idle',
      message: '',
      filesAnalyzed: 0,
      foldersAnalyzed: 0,
      elapsedTime: 0,
      showLoader: false,
    })
  }, [])

  return {
    ...state,
    reset,
  }
}
