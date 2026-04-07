/**
 * ContentThumb
 * Single content thumbnail card used inside PlaylistPreview.
 */
import { Clock, Play } from 'lucide-react'
import { typeIcons, typeColors, defaultTypeIcon, defaultTypeColor } from '@/utils/contentTypes'

export interface ContentPreview {
  id: string
  name: string
  type: string
  url: string
  thumbnail?: string
}

interface ContentThumbProps {
  content: ContentPreview
  duration: number
  index: number
  onClick: () => void
}

export default function ContentThumb({ content, duration, index, onClick }: ContentThumbProps) {
  const Icon = typeIcons[content.type] ?? defaultTypeIcon
  const colorClass = typeColors[content.type] ?? defaultTypeColor
  const isMedia = content.type === 'IMAGE' || content.type === 'VIDEO'

  return (
    <div className="flex-shrink-0 w-32 cursor-pointer group" onClick={onClick}>
      {/* 썸네일 영역 */}
      <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 group-hover:border-blue-400 group-hover:shadow-md transition-all">
        {isMedia && content.url ? (
          <>
            {content.type === 'IMAGE' ? (
              <img
                src={content.url}
                alt={content.name}
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <video
                src={content.url}
                className="w-full h-full object-cover"
                muted
                preload="metadata"
              />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <Play className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
          </>
        ) : (
          <div className={`w-full h-full flex flex-col items-center justify-center gap-1 ${colorClass}`}>
            <Icon className="w-7 h-7" />
            <span className="text-[10px] font-medium uppercase">{content.type}</span>
          </div>
        )}

        {/* 순서 번호 */}
        <div className="absolute top-1 left-1 w-5 h-5 bg-black/60 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
          {index + 1}
        </div>

        {/* 재생시간 */}
        <div className="absolute bottom-1 right-1 flex items-center gap-0.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
          <Clock className="w-2.5 h-2.5" />
          {duration}초
        </div>
      </div>

      {/* 이름 */}
      <p className="text-xs text-gray-600 mt-1.5 truncate text-center px-0.5">{content.name}</p>
    </div>
  )
}
