/**
 * RSS 뉴스 티커 위젯
 */
import { useState, useEffect, useRef } from 'react'
import { Rss } from 'lucide-react'

interface Props {
  config?: {
    url?: string
    scrollSpeed?: number   // px/frame
    color?: string
    fontSize?: number
    bgColor?: string
    maxItems?: number
  }
  width?: number
  height?: number
}

interface RSSItem {
  title: string
  link: string
}

export default function RSSWidget({ config = {}, width = 600, height = 40 }: Props) {
  const [items, setItems] = useState<RSSItem[]>([])
  const [offset, setOffset] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // RSS 파싱은 CORS 제약으로 서버 프록시 필요. 데모 데이터 사용.
    const demoItems: RSSItem[] = [
      { title: '디지털 사이니지 시장 2026년 전망 발표', link: '#' },
      { title: 'SignFlow V4 캔버스 에디터 출시', link: '#' },
      { title: 'AI 기반 콘텐츠 자동 생성 트렌드', link: '#' },
      { title: '스마트 매장 솔루션 도입 사례 분석', link: '#' },
    ]
    setItems(demoItems.slice(0, config.maxItems || 10))
  }, [config.url])

  // 스크롤 애니메이션
  useEffect(() => {
    if (items.length === 0) return
    const speed = config.scrollSpeed || 1
    let animId = 0
    const frame = () => {
      setOffset(prev => {
        const newOffset = prev - speed
        if (containerRef.current && Math.abs(newOffset) > containerRef.current.scrollWidth / 2) {
          return 0
        }
        return newOffset
      })
      animId = requestAnimationFrame(frame)
    }
    animId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animId)
  }, [items, config.scrollSpeed])

  const text = items.map(i => i.title).join('    ★    ')

  return (
    <div
      style={{
        width, height,
        overflow: 'hidden',
        backgroundColor: config.bgColor || 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        borderRadius: 4,
        position: 'relative'
      }}
    >
      <div
        style={{
          padding: '0 8px',
          backgroundColor: config.color || '#EF4444',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          zIndex: 1
        }}
      >
        <Rss style={{ width: 16, height: 16, color: '#fff' }} />
      </div>
      <div
        ref={containerRef}
        style={{
          whiteSpace: 'nowrap',
          transform: `translateX(${offset}px)`,
          color: config.color || '#FFFFFF',
          fontSize: config.fontSize || 14,
          fontFamily: 'Noto Sans KR',
          paddingLeft: 8
        }}
      >
        {text}    ★    {text}
      </div>
    </div>
  )
}

export const rssWidgetDefaults = {
  url: '',
  scrollSpeed: 1,
  color: '#FFFFFF',
  fontSize: 14,
  bgColor: 'rgba(0,0,0,0.6)',
  maxItems: 10
}
