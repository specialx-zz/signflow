/**
 * ContentPreviewOverlay
 * Full-screen overlay for previewing a single content item.
 */
import { X, Music, FileText } from 'lucide-react'
import type { ContentPreview } from './ContentThumb'

interface ContentPreviewOverlayProps {
  content: ContentPreview | null
  onClose: () => void
}

export default function ContentPreviewOverlay({ content, onClose }: ContentPreviewOverlayProps) {
  if (!content) return null

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </button>

      <p className="text-white/70 text-sm mb-4 truncate max-w-lg">{content.name}</p>

      <div
        className="max-w-4xl max-h-[80vh] w-full flex items-center justify-center"
        onClick={e => e.stopPropagation()}
      >
        {content.type === 'IMAGE' ? (
          <img
            src={content.url}
            alt={content.name}
            className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
          />
        ) : content.type === 'VIDEO' ? (
          <video
            src={content.url}
            controls
            autoPlay
            className="max-w-full max-h-[75vh] rounded-lg shadow-2xl"
          />
        ) : content.type === 'AUDIO' ? (
          <div className="flex flex-col items-center gap-4">
            <Music className="w-24 h-24 text-white/40" />
            <audio src={content.url} controls autoPlay className="w-80" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/50">
            <FileText className="w-24 h-24" />
            <p className="text-sm">미리보기를 지원하지 않는 형식입니다</p>
          </div>
        )}
      </div>

      <p className="text-white/40 text-xs mt-4">클릭하면 닫힙니다</p>
    </div>
  )
}
