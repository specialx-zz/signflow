import { X, Music, FileText } from 'lucide-react'

interface PreviewContent {
  id: string
  name: string
  type: string
  url?: string
}

export default function ContentPreviewOverlay({
  content,
  onClose,
}: {
  content: PreviewContent | null
  onClose: () => void
}) {
  if (!content) return null

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[200] flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </button>

      <p className="text-white/60 text-sm mb-4 max-w-xl truncate">{content.name}</p>

      <div
        className="max-w-4xl max-h-[80vh] w-full flex items-center justify-center"
        onClick={e => e.stopPropagation()}
      >
        {content.type === 'IMAGE' ? (
          <img
            src={content.url ?? ''}
            alt={content.name}
            className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl"
          />
        ) : content.type === 'VIDEO' ? (
          <video
            src={content.url ?? ''}
            controls
            autoPlay
            className="max-w-full max-h-[75vh] rounded-xl shadow-2xl"
          />
        ) : content.type === 'AUDIO' ? (
          <div className="flex flex-col items-center gap-6">
            <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center">
              <Music className="w-16 h-16 text-white/50" />
            </div>
            <audio src={content.url ?? ''} controls autoPlay className="w-80" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/40">
            <FileText className="w-24 h-24" />
            <p className="text-sm">미리보기를 지원하지 않는 형식입니다</p>
          </div>
        )}
      </div>

      <p className="text-white/30 text-xs mt-4">배경 클릭 또는 X 버튼으로 닫기</p>
    </div>
  )
}
