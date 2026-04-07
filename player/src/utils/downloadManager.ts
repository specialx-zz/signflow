/**
 * downloadManager.ts
 * 콘텐츠 사전 다운로드 관리자 — Electron 파일시스템 전용
 *
 * 서버에서 콘텐츠 매니페스트를 받아 파일시스템에 다운로드하고
 * 배포 상태를 서버에 보고합니다.
 * 저장 경로: AppData/Roaming/SignFlow Player/content-cache/{contentId}/{filename}
 */

import { apiClient } from './api'
import {
  platformCacheDownload,
  platformIsCached,
  platformGetCachedUrl,
} from './platformBridge'

export interface ManifestItem {
  id: string
  url: string
  size: number
  mimeType: string
  key: string
}

export interface ContentManifest {
  manifest: ManifestItem[]
  version: number
  totalSize: number
  count: number
}

export interface DownloadProgress {
  contentId: string
  status: 'PENDING' | 'DOWNLOADING' | 'COMPLETED' | 'FAILED'
  progress: number
  error?: string
}

type ProgressCallback = (progress: DownloadProgress[]) => void

let isDownloading = false
let currentManifestVersion = 0
let downloadProgress: Map<string, DownloadProgress> = new Map()

/**
 * 매니페스트 조회
 */
export async function fetchManifest(deviceId: string): Promise<ContentManifest> {
  const response = await apiClient.get<ContentManifest>(`/api/devices/${deviceId}/manifest`)
  return response.data
}

/**
 * 배포 상태 서버 보고
 */
async function reportDeploymentStatus(
  deviceId: string,
  items: { contentId: string; status: string; progress: number; errorMessage?: string; fileSize?: number }[]
): Promise<void> {
  try {
    await apiClient.post(`/api/devices/${deviceId}/deployment-status`, { items })
  } catch (err) {
    console.warn('[DownloadManager] 배포 상태 보고 실패:', err)
  }
}

/**
 * 매니페스트의 모든 콘텐츠를 파일시스템에 다운로드
 * 네트워크 과부하 방지를 위해 순차 처리
 */
export async function downloadManifest(
  deviceId: string,
  manifest: ContentManifest,
  onProgress?: ProgressCallback
): Promise<{ downloaded: number; skipped: number; failed: number }> {
  if (isDownloading) {
    console.warn('[DownloadManager] 이미 다운로드 중')
    return { downloaded: 0, skipped: 0, failed: 0 }
  }

  isDownloading = true
  downloadProgress = new Map()

  let downloaded = 0
  let skipped = 0
  let failed = 0

  // 전체 항목 PENDING 초기화
  for (const item of manifest.manifest) {
    downloadProgress.set(item.id, {
      contentId: item.id,
      status: 'PENDING',
      progress: 0,
    })
  }

  onProgress?.(Array.from(downloadProgress.values()))

  try {
    for (const item of manifest.manifest) {
      const filename = item.key.split('/').pop() || item.id

      // 파일시스템 캐시 존재 여부 확인
      const cached = await platformIsCached(item.id, filename)

      if (cached) {
        downloadProgress.set(item.id, {
          contentId: item.id,
          status: 'COMPLETED',
          progress: 100,
        })
        skipped++
        onProgress?.(Array.from(downloadProgress.values()))
        continue
      }

      // 다운로드 시작
      downloadProgress.set(item.id, {
        contentId: item.id,
        status: 'DOWNLOADING',
        progress: 0,
      })
      onProgress?.(Array.from(downloadProgress.values()))

      try {
        console.log(`[DownloadManager] 다운로드: ${item.key} (${formatBytes(item.size)})`)

        const result = await platformCacheDownload(item.url, item.id, filename)
        if (!result.success) throw new Error(result.error || '캐시 저장 실패')

        downloadProgress.set(item.id, {
          contentId: item.id,
          status: 'COMPLETED',
          progress: 100,
        })
        downloaded++

        console.log(`[DownloadManager] 완료: ${item.key}`)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        downloadProgress.set(item.id, {
          contentId: item.id,
          status: 'FAILED',
          progress: 0,
          error: errorMsg,
        })
        failed++
        console.error(`[DownloadManager] 실패: ${item.key}`, err)
      }

      onProgress?.(Array.from(downloadProgress.values()))
    }

    // 최종 배포 상태 보고
    const statusItems = Array.from(downloadProgress.values()).map((p) => ({
      contentId: p.contentId,
      status: p.status,
      progress: p.progress,
      errorMessage: p.error,
      fileSize: manifest.manifest.find((m) => m.id === p.contentId)?.size || 0,
    }))
    await reportDeploymentStatus(deviceId, statusItems)

  } finally {
    isDownloading = false
  }

  console.log(
    `[DownloadManager] 완료 — 다운로드: ${downloaded}, 스킵: ${skipped}, 실패: ${failed}`
  )

  return { downloaded, skipped, failed }
}

/**
 * 전체 동기화: 매니페스트 조회 + 미캐시 콘텐츠 다운로드
 * 시작 시 및 스케줄 변경 시 호출
 */
export async function syncContent(
  deviceId: string,
  onProgress?: ProgressCallback
): Promise<{ downloaded: number; skipped: number; failed: number; version: number }> {
  try {
    console.log('[DownloadManager] 콘텐츠 동기화 시작...')

    const manifest = await fetchManifest(deviceId)

    if (manifest.count === 0) {
      console.log('[DownloadManager] 동기화할 콘텐츠 없음')
      return { downloaded: 0, skipped: 0, failed: 0, version: 0 }
    }

    // 매니페스트 버전 미변경 시 스킵
    if (manifest.version === currentManifestVersion && currentManifestVersion !== 0) {
      console.log('[DownloadManager] 매니페스트 변경 없음, 동기화 스킵')
      return { downloaded: 0, skipped: manifest.count, failed: 0, version: manifest.version }
    }

    console.log(
      `[DownloadManager] 매니페스트: ${manifest.count}개, ${formatBytes(manifest.totalSize)}`
    )

    const result = await downloadManifest(deviceId, manifest, onProgress)

    // 실패 항목 없을 때만 버전 갱신 (다음 동기화 시 재시도 보장)
    if (result.failed === 0) {
      currentManifestVersion = manifest.version
    }

    return { ...result, version: manifest.version }
  } catch (err) {
    console.error('[DownloadManager] 동기화 실패:', err)
    return { downloaded: 0, skipped: 0, failed: 0, version: 0 }
  }
}

/**
 * 현재 다운로드 진행 상태 반환
 */
export function getDownloadProgress(): DownloadProgress[] {
  return Array.from(downloadProgress.values())
}

/**
 * 다운로드 진행 중 여부
 */
export function isDownloadInProgress(): boolean {
  return isDownloading
}

/**
 * 콘텐츠 URL 해결: 파일시스템 캐시 → 없으면 서버 URL
 * Electron: file:// URL
 */
export async function resolveUrl(contentId: string, originalUrl: string): Promise<string> {
  try {
    const filename = originalUrl.split('/').pop() || contentId
    const fileUrl = await platformGetCachedUrl(contentId, filename)
    if (fileUrl) return fileUrl
  } catch {
    // fall through
  }
  return originalUrl
}

// ─── Utility ──────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 하위 호환성 re-export
export { platformGetCacheStats as getCacheStats } from './platformBridge'
