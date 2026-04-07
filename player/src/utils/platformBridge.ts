/**
 * platformBridge.ts
 * 플랫폼 통합 브릿지 — Electron(Windows) / Capacitor(Android) 자동 분기
 *
 * downloadManager.ts 등에서 이 파일만 import하면
 * 플랫폼에 따라 자동으로 올바른 구현체를 사용합니다.
 */

import { isElectron, isCapacitor } from './electronBridge'

// ─── Electron 브릿지 (lazy import로 순환 방지) ───────────────
import {
  electronCacheDownload,
  electronCacheDownloadWithProgress,
  electronIsCached,
  electronGetCachedUrl,
  electronGetCacheStats,
} from './electronBridge'

// ─── Capacitor 브릿지 ────────────────────────────────────────
import {
  capacitorCacheDownload,
  capacitorCacheDownloadWithProgress,
  capacitorIsCached,
  capacitorGetCachedUrl,
  capacitorGetCacheStats,
} from './capacitorBridge'

// ─── 현재 플랫폼 ─────────────────────────────────────────────
export function getPlatform(): 'electron' | 'capacitor' | 'web' {
  if (isElectron()) return 'electron'
  if (isCapacitor()) return 'capacitor'
  return 'web'
}

export function isNativePlatform(): boolean {
  return isElectron() || isCapacitor()
}

// ─── 통합 API ────────────────────────────────────────────────

export async function platformCacheDownload(
  url: string,
  contentId: string,
  filename: string
): Promise<{ success: boolean; localUrl?: string; error?: string }> {
  if (isElectron()) return electronCacheDownload(url, contentId, filename)
  if (isCapacitor()) return capacitorCacheDownload(url, contentId, filename)
  return { success: false, error: 'No native platform available' }
}

export async function platformCacheDownloadWithProgress(
  url: string,
  contentId: string,
  filename: string
): Promise<{ success: boolean; localUrl?: string; error?: string }> {
  if (isElectron()) return electronCacheDownloadWithProgress(url, contentId, filename)
  if (isCapacitor()) return capacitorCacheDownloadWithProgress(url, contentId, filename)
  return { success: false, error: 'No native platform available' }
}

export async function platformIsCached(contentId: string, filename: string): Promise<boolean> {
  if (isElectron()) return electronIsCached(contentId, filename)
  if (isCapacitor()) return capacitorIsCached(contentId, filename)
  return false
}

export async function platformGetCachedUrl(
  contentId: string,
  filename: string
): Promise<string | null> {
  if (isElectron()) return electronGetCachedUrl(contentId, filename)
  if (isCapacitor()) return capacitorGetCachedUrl(contentId, filename)
  return null
}

export async function platformGetCacheStats(): Promise<{
  totalSize: number
  fileCount: number
  cacheDir: string
} | null> {
  if (isElectron()) return electronGetCacheStats()
  if (isCapacitor()) return capacitorGetCacheStats()
  return null
}
