/**
 * cache.ts
 * Electron 전용 배포로 통일됨.
 * IndexedDB는 더 이상 사용하지 않으며, 모든 캐시는 Electron 파일시스템으로 처리됩니다.
 * 하위 호환성을 위해 stub 함수만 유지합니다.
 */

/** @deprecated Electron 모드에서는 electronBridge.electronGetCachedUrl 사용 */
export async function cacheContent(_id: string, _url: string): Promise<string> {
  return _url
}

/** @deprecated Electron 모드에서는 electronBridge.electronGetCachedUrl 사용 */
export async function getCachedContent(_id: string): Promise<string | null> {
  return null
}

/** @deprecated Electron 모드에서는 electronBridge.electronIsCached 사용 */
export async function isContentCached(_id: string): Promise<boolean> {
  return false
}

/** @deprecated */
export async function clearCache(): Promise<void> {}

/** @deprecated */
export async function removeCachedContent(_id: string): Promise<void> {}

/** @deprecated */
export async function getCacheStats(): Promise<{ count: number; totalSize: number }> {
  return { count: 0, totalSize: 0 }
}
