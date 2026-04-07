/**
 * V4 Phase 12b: 캔버스 에디터 왼쪽 패널 — 요소/위젯/템플릿
 */
import { useState, useEffect } from 'react'
import {
  Type, Square, Image, LayoutTemplate, Circle, Triangle,
  Minus, ArrowRight, RectangleHorizontal,
  Clock, Cloud, Rss, QrCode, Play, FileSpreadsheet,
  Globe, BarChart3, Video
} from 'lucide-react'
import { useCanvasStore } from '@/store/canvasStore'
import { useQuery } from '@tanstack/react-query'
import { canvasApi, CanvasTemplate } from '@/api/canvas'

type PanelTab = 'elements' | 'widgets' | 'templates'

export default function LeftPanel() {
  const [activeTab, setActiveTab] = useState<PanelTab>('elements')
  const { addElement, initCanvas } = useCanvasStore()

  const addText = () => {
    addElement({
      type: 'text',
      content: '텍스트를 입력하세요',
      width: 300, height: 60,
      fontSize: 32,
      fontFamily: 'Noto Sans KR',
      color: '#FFFFFF',
      bold: false,
      italic: false,
      underline: false,
      textAlign: 'left'
    })
  }

  const addShape = (shape: string, props?: Partial<Record<string, unknown>>) => {
    const defaults: Record<string, any> = {
      rect: { width: 200, height: 150, fill: '#3B82F6', borderRadius: 0 },
      circle: { width: 150, height: 150, fill: '#10B981', borderRadius: 9999 },
      triangle: { width: 180, height: 160, fill: '#F59E0B' },
      line: { width: 300, height: 4, fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 2 },
      arrow: { width: 300, height: 4, fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 2 },
    }
    addElement({
      type: 'shape',
      shape: shape as any,
      ...defaults[shape],
      ...props
    })
  }

  const addImage = () => {
    addElement({
      type: 'image',
      src: '',
      width: 400, height: 300,
      fit: 'cover'
    })
  }

  const addWidget = (widgetType: string, defaultConfig: Record<string, unknown>, defaultSize: { w: number; h: number }) => {
    addElement({
      type: 'widget',
      widget: widgetType,
      config: defaultConfig,
      width: defaultSize.w,
      height: defaultSize.h,
    })
  }

  // Widget definitions
  const widgets = [
    {
      id: 'clock', icon: Clock, label: '디지털 시계', color: 'blue',
      desc: '시간/날짜 표시',
      defaults: { format: 'HH:mm:ss', showDate: true, dateFormat: 'yyyy-MM-dd', color: '#FFFFFF', fontFamily: 'Noto Sans KR' },
      size: { w: 300, h: 120 }
    },
    {
      id: 'weather', icon: Cloud, label: '날씨', color: 'cyan',
      desc: 'OpenWeatherMap',
      defaults: { city: 'Seoul', units: 'metric', apiKey: '', color: '#FFFFFF', bgColor: 'rgba(0,0,0,0.4)' },
      size: { w: 280, h: 140 }
    },
    {
      id: 'rss', icon: Rss, label: 'RSS 뉴스', color: 'red',
      desc: '뉴스 티커',
      defaults: { url: '', scrollSpeed: 1, color: '#FFFFFF', fontSize: 14, bgColor: 'rgba(0,0,0,0.6)', maxItems: 10 },
      size: { w: 600, h: 40 }
    },
    {
      id: 'qrcode', icon: QrCode, label: 'QR코드', color: 'green',
      desc: 'URL→QR 변환',
      defaults: { url: 'https://signflow.app', size: 120, bgColor: '#FFFFFF', fgColor: '#000000', label: '', labelColor: '#FFFFFF' },
      size: { w: 160, h: 190 }
    },
    {
      id: 'video', icon: Video, label: '비디오', color: 'purple',
      desc: '동영상 재생',
      defaults: { src: '', autoplay: true, loop: true, muted: true },
      size: { w: 640, h: 360 }
    },
    {
      id: 'webpage', icon: Globe, label: '웹페이지', color: 'indigo',
      desc: 'URL 임베드',
      defaults: { url: 'https://example.com', refreshInterval: 0 },
      size: { w: 800, h: 600 }
    },
    {
      id: 'spreadsheet', icon: FileSpreadsheet, label: '스프레드시트', color: 'emerald',
      desc: 'Google Sheets',
      defaults: { url: '', refreshInterval: 300 },
      size: { w: 800, h: 500 }
    },
    {
      id: 'chart', icon: BarChart3, label: '차트', color: 'amber',
      desc: '데이터 시각화',
      defaults: { type: 'bar', data: [], title: '', bgColor: 'rgba(0,0,0,0.4)', color: '#FFFFFF' },
      size: { w: 400, h: 300 }
    },
  ]

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    cyan: 'bg-cyan-100 text-cyan-600',
    red: 'bg-red-100 text-red-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
  }

  // Templates query
  const { data: templates } = useQuery({
    queryKey: ['canvasTemplates'],
    queryFn: () => canvasApi.listTemplates(),
    enabled: activeTab === 'templates'
  })

  return (
    <div className="w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['elements', 'widgets', 'templates'] as PanelTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-medium ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            {tab === 'elements' ? '요소' : tab === 'widgets' ? '위젯' : '템플릿'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {/* ─── 요소 탭 ─── */}
        {activeTab === 'elements' && (
          <div className="space-y-4">
            {/* Text */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">텍스트</h4>
              <button
                onClick={addText}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Type className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">텍스트</p>
                  <p className="text-xs text-gray-400">텍스트 추가</p>
                </div>
              </button>
            </div>

            {/* Shapes */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">도형</h4>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: RectangleHorizontal, label: '사각형', shape: 'rect' },
                  { icon: Circle, label: '원', shape: 'circle' },
                  { icon: Triangle, label: '삼각형', shape: 'triangle' },
                  { icon: Minus, label: '직선', shape: 'line' },
                  { icon: ArrowRight, label: '화살표', shape: 'arrow' },
                ].map(({ icon: Icon, label, shape }) => (
                  <button
                    key={shape}
                    onClick={() => addShape(shape)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <Icon className="w-5 h-5 text-gray-600" />
                    <span className="text-xs text-gray-500">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Image */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">미디어</h4>
              <button
                onClick={addImage}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Image className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">이미지</p>
                  <p className="text-xs text-gray-400">이미지 추가</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ─── 위젯 탭 ─── */}
        {activeTab === 'widgets' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-3">위젯을 클릭하면 캔버스에 추가됩니다</p>
            {widgets.map(w => (
              <button
                key={w.id}
                onClick={() => addWidget(w.id, w.defaults, w.size)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[w.color]}`}>
                  <w.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{w.label}</p>
                  <p className="text-xs text-gray-400 truncate">{w.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ─── 템플릿 탭 ─── */}
        {activeTab === 'templates' && (
          <div className="space-y-3">
            {/* Built-in presets */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">기본 프리셋</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '공지사항', bg: '#1E3A5F', desc: '텍스트 중심' },
                  { label: '매장 안내', bg: '#2D1B4E', desc: '이미지+텍스트' },
                  { label: '메뉴보드', bg: '#1A1A2E', desc: '그리드 레이아웃' },
                  { label: '프로모션', bg: '#4A1919', desc: '배너 스타일' },
                ].map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      // 프리셋 템플릿 적용
                      const store = useCanvasStore.getState()
                      store.setCanvasBackground(preset.bg)
                      addText()
                    }}
                    className="flex flex-col items-center p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div
                      className="w-full h-14 rounded mb-2"
                      style={{ backgroundColor: preset.bg }}
                    />
                    <span className="text-xs font-medium text-gray-700">{preset.label}</span>
                    <span className="text-xs text-gray-400">{preset.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* User/shared templates */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">저장된 템플릿</h4>
              {templates && templates.length > 0 ? (
                <div className="space-y-2">
                  {templates.map((t: CanvasTemplate) => (
                    <button
                      key={t.id}
                      onClick={() => canvasApi.useTemplate(t.id)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                    >
                      {t.thumbnail ? (
                        <img src={t.thumbnail} className="w-12 h-8 rounded object-cover" alt="" />
                      ) : (
                        <div className="w-12 h-8 bg-gray-200 rounded flex items-center justify-center">
                          <LayoutTemplate className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{t.name}</p>
                        <p className="text-xs text-gray-400">{t.category}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">
                  에디터에서 현재 캔버스를 템플릿으로 저장할 수 있습니다
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
