/**
 * capacitorBridge.ts
 * Capacitor 네이티브 브릿지 — Android 전용
 *
 * electronBridge.ts와 동일한 인터페이스를 제공하여
 * platformBridge.ts에서 투명하게 교체 가능합니다.
 *
 * 저장 경로: Android 앱 내부 저장소 / content-cache/{contentId}/{filename}
 */

import { Filesystem, Directory } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'

const CACHE_DIR = 'content-cache'

// ─── 유틸 ───────────────────────────────────────────────────

function getRelativePath(contentId: string, filename: string): string {
  return `${CACHE_DIR}/${contentId}/${filename}`
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // "data:image/png;base64,XXXX" → "XXXX"
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// ─── 파일 다운로드 & 캐시 ────────────────────────────────────

/**
 * 콘텐츠 파일을 앱 내부 스토리지에 다운로드 & 저장
 */
export async function capacitorCacheDownload(
  url: string,
  contentId: string,
  filename: string
): Promise<{ success: boolean; localUrl?: string; error?: string }> {
  try {
    const path = getRelativePath(contentId, filename)

    // 디렉터리 생성 (없으면)
    await Filesystem.mkdir({
      path: `${CACHE_DIR}/${contentId}`,
      directory: Directory.Data,
      recursive: true,
    }).catch(() => {}) // 이미 존재하면 무시

    // 파일 다운로드
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
    const blob = await response.blob()
    const base64data = await blobToBase64(blob)

    // 파일 저장
    await Filesystem.writeFile({
      path,
      data: base64data,
      directory: Directory.Data,
    })

    // WebView에서 재생 가능한 URL로 변환
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Data })
    const localUrl = Capacitor.convertFileSrc(uri)

    return { success: true, localUrl }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Download failed'
    console.error(`[CapacitorBridge] 다운로드 실패: ${filename}`, err)
    return { success: false, error }
  }
}

/**
 * 진행률 콜백 포함 다운로드 (Electron과 인터페이스 동일)
 * Capacitor는 fetch 스트리밍으로 진행률 추적
 */
export async function capacitorCacheDownloadWithProgress(
  url: string,
  contentId: string,
  filename: string
): Promise<{ success: boolean; localUrl?: string; error?: string }> {
  // 현재는 기본 다운로드와 동일 (진행률 추적은 향후 개선)
  return capacitorCacheDownload(url, contentId, filename)
}

// ─── 캐시 조회 ──────────────────────────────────────────────

/**
 * 파일이 캐시에 존재하는지 확인
 */
export async function capacitorIsCached(contentId: string, filename: string): Promise<boolean> {
  try {
    const path = getRelativePath(contentId, filename)
    await Filesystem.stat({ path, directory: Directory.Data })
    return true
  } catch {
    return false
  }
}

/**
 * 캐시된 파일의 WebView 재생 URL 반환 (없으면 null)
 */
export async function capacitorGetCachedUrl(
  contentId: string,
  filename: string
): Promise<string | null> {
  try {
    const path = getRelativePath(contentId, filename)
    await Filesystem.stat({ path, directory: Directory.Data })
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Data })
    return Capacitor.convertFileSrc(uri)
  } catch {
    return null
  }
}

// ─── 캐시 통계 ──────────────────────────────────────────────

export async function capacitorGetCacheStats(): Promise<{
  totalSize: number
  fileCount: number
  cacheDir: string
}> {
  try {
    const { uri } = await Filesystem.getUri({ path: CACHE_DIR, directory: Directory.Data })
    return { totalSize: 0, fileCount: 0, cacheDir: uri }
  } catch {
    return { totalSize: 0, fileCount: 0, cacheDir: CACHE_DIR }
  }
}
