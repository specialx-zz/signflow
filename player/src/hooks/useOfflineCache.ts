/**
 * useOfflineCache.ts
 * Electron 전용 배포로 통일됨.
 * 콘텐츠 캐싱은 useContentSync (downloadManager)에서 전담합니다.
 * 이 훅은 하위 호환성을 위해 유지되며 no-op입니다.
 */

import { useCallback } from 'react'
import { resolveUrl } from '../utils/downloadManager'

export function useOfflineCache() {
  /**
   * 콘텐츠 URL 해결: 파일시스템 캐시 → 없으면 서버 URL
   */
  const resolveContentUrl = useCallback(
    async (contentId: string, originalUrl: string): Promise<string> => {
      return resolveUrl(contentId, originalUrl)
    },
    []
  )

  return { resolveContentUrl }
}
