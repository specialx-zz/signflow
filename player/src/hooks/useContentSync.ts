/**
 * useContentSync.ts
 * Hook that manages content pre-download synchronization.
 * Triggers sync on startup and when schedules change.
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { syncContent, resolveUrl, type DownloadProgress } from '../utils/downloadManager'
import type { ContentSyncStatus } from '../types'

// Sync interval: check for new content every 5 minutes
const SYNC_INTERVAL = 5 * 60 * 1000

export function useContentSync() {
  const { config, schedules } = usePlayerStore()
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastScheduleHashRef = useRef<string>('')

  const [syncStatus, setSyncStatus] = useState<ContentSyncStatus>({
    isSyncing: false,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    total: 0,
    version: 0,
    lastSyncAt: null,
  })

  const handleProgress = useCallback((progress: DownloadProgress[]) => {
    const total = progress.length
    const completed = progress.filter((p) => p.status === 'COMPLETED').length
    const downloading = progress.filter((p) => p.status === 'DOWNLOADING').length
    const failed = progress.filter((p) => p.status === 'FAILED').length

    setSyncStatus((prev) => ({
      ...prev,
      isSyncing: downloading > 0,
      downloaded: completed,
      failed,
      total,
    }))
  }, [])

  const doSync = useCallback(async () => {
    if (!config?.deviceId) return

    setSyncStatus((prev) => ({ ...prev, isSyncing: true }))

    try {
      const result = await syncContent(config.deviceId, handleProgress)

      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        downloaded: result.downloaded,
        skipped: result.skipped,
        failed: result.failed,
        version: result.version,
        lastSyncAt: new Date().toISOString(),
      }))
    } catch (err) {
      console.error('[ContentSync] Sync error:', err)
      setSyncStatus((prev) => ({ ...prev, isSyncing: false }))
    }
  }, [config?.deviceId, handleProgress])

  // Initial sync on mount + periodic sync
  useEffect(() => {
    if (!config?.deviceId) return

    // Initial sync after a short delay (let schedules load first)
    const initTimer = setTimeout(() => {
      doSync()
    }, 3000)

    // Periodic sync
    syncTimerRef.current = setInterval(doSync, SYNC_INTERVAL)

    return () => {
      clearTimeout(initTimer)
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current)
      }
    }
  }, [config?.deviceId, doSync])

  // Re-sync when schedules change
  useEffect(() => {
    if (!schedules?.length) return

    const hash = schedules.map((s) => s.id).sort().join(',')
    if (hash !== lastScheduleHashRef.current && lastScheduleHashRef.current !== '') {
      console.log('[ContentSync] Schedules changed, triggering sync...')
      doSync()
    }
    lastScheduleHashRef.current = hash
  }, [schedules, doSync])

  return {
    syncStatus,
    triggerSync: doSync,
    resolveContentUrl: resolveUrl,
  }
}
