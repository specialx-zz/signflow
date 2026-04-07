/**
 * V4 Phase 16: 비디오 위젯
 * 동영상 재생 (로컬 파일 또는 URL)
 */
import { Play } from 'lucide-react'

interface Props {
  config?: {
    src?: string
    autoplay?: boolean
    loop?: boolean
    muted?: boolean
  }
  width?: number
  height?: number
}

export default function VideoWidget({ config = {}, width = 640, height = 360 }: Props) {
  const src = config.src

  if (!src) {
    return (
      <div
        style={{
          width, height,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          borderRadius: 8, border: '2px dashed rgba(255,255,255,0.2)'
        }}
      >
        <Play style={{ width: 48, height: 48, color: 'rgba(255,255,255,0.3)' }} />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8, fontFamily: 'Noto Sans KR' }}>
          비디오 URL을 설정하세요
        </span>
      </div>
    )
  }

  return (
    <video
      src={src}
      autoPlay={config.autoplay !== false}
      loop={config.loop !== false}
      muted={config.muted !== false}
      playsInline
      style={{
        width, height,
        objectFit: 'cover',
        borderRadius: 4,
        backgroundColor: '#000'
      }}
    />
  )
}

export const videoWidgetDefaults = {
  src: '',
  autoplay: true,
  loop: true,
  muted: true
}
