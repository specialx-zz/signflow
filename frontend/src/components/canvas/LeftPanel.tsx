/**
 * VueSign Phase W1: Canvas v2.0 Left Panel
 *
 * 3개 탭:
 *   - 요소: 텍스트 + 이미지(오버레이) 추가
 *   - 위젯: 날씨 6종 + 대기질 3종
 *   - 이미지: 콘텐츠 라이브러리에서 배경/이미지 선택
 *
 * v1의 도형(rect, circle, triangle, line, arrow)과 불필요한 위젯(clock/rss/qr/chart 등)은 모두 제거됨.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Type, Image as ImageIcon, CloudSun, Wind, Layers, Search } from 'lucide-react'
import { useCanvasStore } from '@/store/canvasStore'
import { contentApi } from '@/api/content'
import { weatherApi } from '@/api/weather'
import { WidgetKey } from '@/api/canvas'
import { WEATHER_WIDGET_LABELS } from './widgets/WeatherWidgets'

type PanelTab = 'elements' | 'widgets' | 'images'

export default function LeftPanel() {
  const [activeTab, setActiveTab] = useState<PanelTab>('elements')
  const [search, setSearch] = useState('')
  const { addElement, addWidget, setCanvasBackgroundImage } = useCanvasStore()

  // 위젯 추가 시 자동으로 기본 locationId 를 채워주기 위한 선행 로드.
  // 사용자가 위치를 고르지 않더라도 처음부터 실제 날씨 데이터가 표시되도록 한다.
  const { data: locationsData } = useQuery({
    queryKey: ['weather.locations'],
    queryFn: () => weatherApi.listLocations(),
    staleTime: 60 * 60 * 1000,
  })
  const defaultLocationId = locationsData?.locations?.[0]?.id

  // ─── 요소 탭 핸들러 ─────
  const addText = () => {
    addElement({
      type: 'text',
      content: '텍스트를 입력하세요',
      width: 400,
      height: 80,
      fontSize: 36,
      fontFamily: 'Noto Sans KR',
      color: '#FFFFFF',
      bold: false,
      textAlign: 'left',
    })
  }

  const addImage = () => {
    addElement({
      type: 'image',
      src: '',
      width: 400,
      height: 300,
      fit: 'cover',
    })
  }

  // ─── 위젯 정의 ─────
  const weatherWidgets: { key: WidgetKey; icon: typeof CloudSun; desc: string }[] = [
    { key: 'weather.current',       icon: CloudSun, desc: '아이콘 + 온도 + 고/저 + 위치' },
    { key: 'weather.current.icon',  icon: CloudSun, desc: '날씨 아이콘 단독' },
    { key: 'weather.current.temp',  icon: CloudSun, desc: '현재 온도 숫자' },
    { key: 'weather.today.minmax',  icon: CloudSun, desc: '오늘 최고/최저' },
    { key: 'weather.location',      icon: CloudSun, desc: '위치 라벨' },
    { key: 'weather.weekly',        icon: CloudSun, desc: '7일 예보 카드' },
  ]
  const airWidgets: { key: WidgetKey; icon: typeof Wind; desc: string }[] = [
    { key: 'air.pm.value', icon: Wind, desc: 'PM10/PM2.5 수치' },
    { key: 'air.pm.grade', icon: Wind, desc: '등급 뱃지' },
    { key: 'air.pm.card',  icon: Wind, desc: '대기질 종합 카드' },
  ]

  // ─── 이미지 탭: 콘텐츠 라이브러리 ─────
  const { data: images, isLoading } = useQuery({
    queryKey: ['content.images', search],
    queryFn: () => contentApi.getAll({ type: 'IMAGE', search }),
    enabled: activeTab === 'images',
  })

  const imageList: any[] = Array.isArray(images?.content) ? images.content : Array.isArray(images) ? images : []

  const useImageAsBackground = (url: string) => {
    setCanvasBackgroundImage(url)
  }

  const addImageAsOverlay = (url: string) => {
    addElement({
      type: 'image',
      src: url,
      width: 600,
      height: 400,
      fit: 'cover',
    })
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['elements', 'widgets', 'images'] as PanelTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-medium ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            {tab === 'elements' ? '요소' : tab === 'widgets' ? '위젯' : '이미지'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {/* ─── 요소 탭 ─── */}
        {activeTab === 'elements' && (
          <div className="space-y-3">
            <button
              onClick={addText}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                <Type className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">텍스트</p>
                <p className="text-xs text-gray-400">텍스트 박스 추가</p>
              </div>
            </button>

            <button
              onClick={addImage}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors text-left"
            >
              <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">이미지 (빈)</p>
                <p className="text-xs text-gray-400">URL을 속성에서 입력</p>
              </div>
            </button>

            <div className="pt-2 mt-2 border-t border-gray-100 text-xs text-gray-400 leading-relaxed">
              💡 배경 이미지는 "이미지" 탭에서 선택하거나 오른쪽 패널(캔버스 설정)에서 URL을 입력하세요.
            </div>
          </div>
        )}

        {/* ─── 위젯 탭 ─── */}
        {activeTab === 'widgets' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase flex items-center gap-1.5">
                <CloudSun className="w-3.5 h-3.5" /> 날씨
              </h4>
              <div className="space-y-1.5">
                {weatherWidgets.map(w => (
                  <button
                    key={w.key}
                    onClick={() => addWidget(w.key, defaultLocationId)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-lg border border-gray-200 hover:border-cyan-300 hover:bg-cyan-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center shrink-0">
                      <w.icon className="w-4 h-4 text-cyan-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{WEATHER_WIDGET_LABELS[w.key]}</p>
                      <p className="text-[10px] text-gray-400 truncate">{w.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5" /> 대기질
              </h4>
              <div className="space-y-1.5">
                {airWidgets.map(w => (
                  <button
                    key={w.key}
                    onClick={() => addWidget(w.key, defaultLocationId)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                      <w.icon className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{WEATHER_WIDGET_LABELS[w.key]}</p>
                      <p className="text-[10px] text-gray-400 truncate">{w.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 text-xs text-gray-400 leading-relaxed">
              💡 위젯을 추가하면 기본 위치({locationsData?.locations?.[0]?.displayName || '서울특별시'})로 자동 설정됩니다. 오른쪽 패널에서 원하는 시/구로 변경할 수 있어요. 플레이어가 실시간으로 기상청/에어코리아 데이터를 표시합니다.
            </div>
          </div>
        )}

        {/* ─── 이미지 탭 ─── */}
        {activeTab === 'images' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="이미지 검색"
                className="w-full text-xs pl-7 pr-2 py-1.5 border rounded bg-gray-50"
              />
            </div>

            {isLoading && (
              <div className="text-xs text-gray-400 text-center py-4">로딩 중…</div>
            )}

            {!isLoading && imageList.length === 0 && (
              <div className="text-xs text-gray-400 text-center py-4">
                콘텐츠 라이브러리에 이미지가 없습니다.<br />콘텐츠 페이지에서 먼저 업로드하세요.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {imageList.map((img: any) => {
                const src = img.thumbnail || img.filePath || img.url || ''
                return (
                  <div
                    key={img.id}
                    className="group relative border border-gray-200 rounded overflow-hidden hover:border-blue-400 transition-colors"
                  >
                    <div className="aspect-video bg-gray-100 flex items-center justify-center">
                      {src ? (
                        <img src={src} alt={img.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <div className="p-1">
                      <p className="text-[10px] text-gray-600 truncate">{img.name}</p>
                    </div>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                      <button
                        onClick={() => useImageAsBackground(src)}
                        className="w-full px-2 py-1 text-[10px] bg-white/90 hover:bg-white text-gray-800 rounded flex items-center justify-center gap-1"
                      >
                        <Layers className="w-3 h-3" /> 배경으로
                      </button>
                      <button
                        onClick={() => addImageAsOverlay(src)}
                        className="w-full px-2 py-1 text-[10px] bg-blue-500 hover:bg-blue-600 text-white rounded"
                      >
                        오버레이 추가
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
