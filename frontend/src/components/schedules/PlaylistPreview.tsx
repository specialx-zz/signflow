/**
 * PlaylistPreview
 * Fetches a playlist and renders a horizontal scrollable thumbnail strip.
 */
import { useQuery } from '@tanstack/react-query'
import { Film, ChevronRight } from 'lucide-react'
import { playlistApi } from '@/api/playlists'
import ContentThumb, { type ContentPreview } from './ContentThumb'

interface PlaylistPreviewProps {
  playlistId: string
  onContentClick: (content: ContentPreview) => void
}

export default function PlaylistPreview({ playlistId, onContentClick }: PlaylistPreviewProps) {
  const { data: playlist, isLoading } = useQuery({
    queryKey: ['playlist-preview', playlistId],
    queryFn: () => playlistApi.getById(playlistId),
    enabled: !!playlistId,
    staleTime: 30000
  })

  if (!playlistId) return null

  if (isLoading) {
    return (
      <div className="col-span-2 bg-gray-50 rounded-xl p-4 flex items-center gap-3">
        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
        <span className="text-sm text-gray-500">플레이리스트 불러오는 중...</span>
      </div>
    )
  }

  if (!playlist?.items?.length) {
    return (
      <div className="col-span-2 bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center">
        <Film className="w-6 h-6 text-gray-300 mx-auto mb-1" />
        <p className="text-xs text-gray-400">플레이리스트에 콘텐츠가 없습니다</p>
      </div>
    )
  }

  const totalDuration = playlist.items.reduce((s: number, i: { duration: number }) => s + i.duration, 0)
  const mins = Math.floor(totalDuration / 60)
  const secs = totalDuration % 60

  return (
    <div className="col-span-2 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-blue-800">플레이리스트 미리보기</span>
          <span className="text-xs text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">
            {playlist.items.length}개 항목
          </span>
        </div>
        <span className="text-xs text-blue-500">
          총 {mins > 0 ? `${mins}분 ` : ''}{secs}초
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-blue-200 scrollbar-track-transparent">
        {playlist.items.map((item: { id: string; content: ContentPreview; duration: number }, idx: number) => (
          <ContentThumb
            key={item.id}
            content={item.content}
            duration={item.duration}
            index={idx}
            onClick={() => onContentClick(item.content)}
          />
        ))}
      </div>

      <p className="text-[11px] text-blue-400 mt-2 flex items-center gap-1">
        <ChevronRight className="w-3 h-3" />
        썸네일을 클릭하면 크게 볼 수 있습니다
      </p>
    </div>
  )
}
