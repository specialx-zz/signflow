/**
 * electronBridge.ts
 * Electron IPC 브릿지 — Electron 전용 배포 모드
 * 모든 캐시는 파일시스템에 저장됩니다. (AppData/Roaming/VueSign Player/content-cache/)
 */

/**
 * Electron 환경 여부 확인 (Windows 데스크탑)
 */
export function isElectron(): boolean {
  return !!window.electronAPI?.isElectron
}

/**
 * Capacitor 환경 여부 확인 (Android / iOS)
 */
export function isCapacitor(): boolean {
  return !!(window as any).Capacitor?.isNativePlatform?.()
}

export function getElectronAPI() {
  return window.electronAPI || null
}

/**
 * 콘텐츠 파일을 파일시스템에 다운로드 & 캐시 (진행률 없음 — 백그라운드 동기화용)
 */
export async function electronCacheDownload(
  url: string,
  contentId: string,
  filename: string
): Promise<{ success: boolean; localUrl?: string; error?: string }> {
  const api = getElectronAPI()
  if (!api) {
    console.error('[electronBridge] electronAPI를 찾을 수 없습니다. Electron 환경인지 확인하세요.')
    return { success: false, error: 'electronAPI not available' }
  }

  const result = await api.cache.download(url, contentId, filename)
  if (result.success && result.path) {
    return { success: true, localUrl: `file://${result.path.replace(/\\/g, '/')}` }
  }
  return { success: false, error: result.error }
}

export interface DownloadProgressEvent {
  contentId: string
  received: number
  total: number
  percent: number
}

/**
 * 진행률 이벤트 포함 다운로드 — 재생 직전 다운로드 (프로그레스바 표시용)
 */
export async function electronCacheDownloadWithProgress(
  url: string,
  contentId: string,
  filename: string
): Promise<{ success: boolean; localUrl?: string; error?: string }> {
  const api = getElectronAPI()
  if (!api) return { success: false, error: 'electronAPI not available' }

  const result = await api.cache.downloadWithProgress(url, contentId, filename)
  if (result.success && result.path) {
    return { success: true, localUrl: `file://${result.path.replace(/\\/g, '/')}` }
  }
  return { success: false, error: result.error }
}

/**
 * 다운로드 진행률 이벤트 구독
 * @returns unsubscribe 함수
 */
export function onDownloadProgress(
  callback: (data: DownloadProgressEvent) => void
): () => void {
  const api = getElectronAPI()
  if (!api) return () => {}
  return api.cache.onDownloadProgress(callback)
}

/**
 * 캐시된 파일의 file:// URL 반환
 * 캐시 없으면 null
 */
export async function electronGetCachedUrl(
  contentId: string,
  filename: string
): Promise<string | null> {
  const api = getElectronAPI()
  if (!api) return null
  return api.cache.getPath(contentId, filename)
}

/**
 * 캐시 존재 여부 확인
 */
export async function electronIsCached(
  contentId: string,
  filename: string
): Promise<boolean> {
  const api = getElectronAPI()
  if (!api) return false
  return api.cache.exists(contentId, filename)
}

/**
 * 캐시 통계 (총 용량, 파일 수, 캐시 경로)
 */
export async function electronGetCacheStats(): Promise<{
  totalSize: number
  fileCount: number
  cacheDir: string
} | null> {
  const api = getElectronAPI()
  if (!api) return null
  return api.cache.stats()
}

/**
 * 시스템 정보 조회
 */
export async function getSystemInfo() {
  const api = getElectronAPI()
  if (!api) {
    return {
      platform: 'unknown',
      arch: 'unknown',
      version: '1.0.0',
      electronVersion: 'N/A',
      isKiosk: false,
      isDev: false,
      cacheDir: 'N/A',
      userData: 'N/A',
      isElectronApp: false,
    }
  }
  const info = await api.system.info()
  return { ...info, isElectronApp: true }
}
