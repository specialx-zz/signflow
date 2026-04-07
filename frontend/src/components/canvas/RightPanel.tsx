/**
 * V4 Phase 12b: 캔버스 에디터 오른쪽 패널 — 속성 편집 + 위젯 설정 + 애니메이션
 */
import { useState } from 'react'
import { useCanvasStore } from '@/store/canvasStore'
import { CanvasElement } from '@/api/canvas'
import { useQuery } from '@tanstack/react-query'
import { fontApi } from '@/api/fonts'
import {
  Trash2, Copy, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown,
  Lock, Unlock, Eye, EyeOff, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Underline, Sparkles
} from 'lucide-react'

function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-16">{label}</label>
      <div className="relative">
        <input
          type="color"
          value={value || '#000000'}
          onChange={e => onChange(e.target.value)}
          className="w-7 h-7 rounded border cursor-pointer"
        />
      </div>
      <input
        type="text"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="flex-1 text-xs px-2 py-1 border rounded bg-gray-50 font-mono"
        placeholder="#000000"
      />
    </div>
  )
}

function NumberInput({ value, onChange, label, min, max, step = 1 }: {
  value: number; onChange: (v: number) => void; label: string; min?: number; max?: number; step?: number
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-16">{label}</label>
      <input
        type="number"
        value={value ?? 0}
        onChange={e => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="flex-1 text-xs px-2 py-1 border rounded bg-gray-50"
      />
    </div>
  )
}

function SelectInput({ value, onChange, label, options }: {
  value: string; onChange: (v: string) => void; label: string; options: { value: string; label: string }[]
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-16">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 text-xs px-2 py-1 border rounded bg-gray-50"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ─── 위젯별 설정 패널 ────────────────────────
function WidgetConfigPanel({ widget, config, onChange }: {
  widget: string
  config: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}) {
  const c = config || {}

  switch (widget) {
    case 'clock':
      return (
        <div className="space-y-2">
          <SelectInput label="시간형식" value={String(c.format || 'HH:mm:ss')} onChange={v => onChange('format', v)} options={[
            { value: 'HH:mm:ss', label: '24시간 (초)' },
            { value: 'HH:mm', label: '24시간' },
            { value: 'hh:mm A', label: '12시간' },
            { value: 'hh:mm:ss A', label: '12시간 (초)' },
          ]} />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-16">날짜표시</label>
            <input type="checkbox" checked={c.showDate !== false} onChange={e => onChange('showDate', e.target.checked)} />
          </div>
          <SelectInput label="날짜형식" value={String(c.dateFormat || 'yyyy-MM-dd')} onChange={v => onChange('dateFormat', v)} options={[
            { value: 'yyyy-MM-dd', label: '2024-01-15' },
            { value: 'MM/dd/yyyy', label: '01/15/2024' },
            { value: 'yyyy년 MM월 dd일', label: '2024년 01월 15일' },
          ]} />
          <ColorInput label="색상" value={String(c.color || '#FFFFFF')} onChange={v => onChange('color', v)} />
        </div>
      )

    case 'weather':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-16">도시</label>
            <input
              type="text"
              value={String(c.city || 'Seoul')}
              onChange={e => onChange('city', e.target.value)}
              className="flex-1 text-xs px-2 py-1 border rounded bg-gray-50"
            />
          </div>
          <SelectInput label="단위" value={String(c.units || 'metric')} onChange={v => onChange('units', v)} options={[
            { value: 'metric', label: 'Celsius' },
            { value: 'imperial', label: 'Fahrenheit' },
          ]} />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-16">API Key</label>
            <input
              type="text"
              value={String(c.apiKey || '')}
              onChange={e => onChange('apiKey', e.target.value)}
              className="flex-1 text-xs px-2 py-1 border rounded bg-gray-50"
              placeholder="OpenWeatherMap"
            />
          </div>
          <ColorInput label="색상" value={String(c.color || '#FFFFFF')} onChange={v => onChange('color', v)} />
          <ColorInput label="배경색" value={String(c.bgColor || 'rgba(0,0,0,0.4)')} onChange={v => onChange('bgColor', v)} />
        </div>
      )

    case 'rss':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-16">RSS URL</label>
            <input
              type="text"
              value={String(c.url || '')}
              onChange={e => onChange('url', e.target.value)}
              className="flex-1 text-xs px-2 py-1 border rounded bg-gray-50"
              placeholder="https://..."
            />
          </div>
          <NumberInput label="속도" value={Number(c.scrollSpeed || 1)} onChange={v => onChange('scrollSpeed', v)} min={0.5} max={5} step={0.5} />
          <NumberInput label="크기" value={Number(c.fontSize || 14)} onChange={v => onChange('fontSize', v)} min={10} max={48} />
          <NumberInput label="최대 수" value={Number(c.maxItems || 10)} onChange={v => onChange('maxItems', v)} min={1} max={50} />
          <ColorInput label="색상" value={String(c.color || '#FFFFFF')} onChange={v => onChange('color', v)} />
          <ColorInput label="배경색" value={String(c.bgColor || 'rgba(0,0,0,0.6)')} onChange={v => onChange('bgColor', v)} />
        </div>
      )

    case 'qrcode':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-16">URL</label>
            <input
              type="text"
              value={String(c.url || 'https://signflow.app')}
              onChange={e => onChange('url', e.target.value)}
              className="flex-1 text-xs px-2 py-1 border rounded bg-gray-50"
            />
          </div>
          <NumberInput label="크기" value={Number(c.size || 120)} onChange={v => onChange('size', v)} min={50} max={500} />
          <ColorInput label="배경색" value={String(c.bgColor || '#FFFFFF')} onChange={v => onChange('bgColor', v)} />
          <ColorInput label="전경색" value={String(c.fgColor || '#000000')} onChange={v => onChange('fgColor', v)} />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-16">라벨</label>
            <input
              type="text"
              value={String(c.label || '')}
              onChange={e => onChange('label', e.target.value)}
              className="flex-1 text-xs px-2 py-1 border rounded bg-gray-50"
            />
          </div>
        </div>
      )

    case 'video':
      return (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-500">비디오 URL</label>
            <input
              type="text"
              value={String(c.src || '')}
              onChange={e => onChange('src', e.target.value)}
              className="w-full text-xs px-2 py-1 border rounded bg-gray-50 mt-1"
              placeholder="/uploads/videos/... 또는 URL"
            />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" checked={c.autoplay !== false} onChange={e => onChange('autoplay', e.target.checked)} />
              자동재생
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" checked={c.loop !== false} onChange={e => onChange('loop', e.target.checked)} />
              반복
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" checked={c.muted !== false} onChange={e => onChange('muted', e.target.checked)} />
              음소거
            </label>
          </div>
        </div>
      )

    case 'webpage':
      return (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-500">URL</label>
            <input
              type="text"
              value={String(c.url || '')}
              onChange={e => onChange('url', e.target.value)}
              className="w-full text-xs px-2 py-1 border rounded bg-gray-50 mt-1"
              placeholder="https://..."
            />
          </div>
          <NumberInput label="새로고침" value={Number(c.refreshInterval || 0)} onChange={v => onChange('refreshInterval', v)} min={0} step={30} />
          <p className="text-xs text-gray-400">0 = 새로고침 안 함 (초 단위)</p>
        </div>
      )

    case 'spreadsheet':
      return (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-500">Google Sheets 공유 URL</label>
            <input
              type="text"
              value={String(c.url || '')}
              onChange={e => onChange('url', e.target.value)}
              className="w-full text-xs px-2 py-1 border rounded bg-gray-50 mt-1"
              placeholder="https://docs.google.com/spreadsheets/..."
            />
          </div>
          <NumberInput label="새로고침" value={Number(c.refreshInterval || 300)} onChange={v => onChange('refreshInterval', v)} min={60} step={60} />
          <p className="text-xs text-gray-400">초 단위 (최소 60초)</p>
        </div>
      )

    case 'chart':
      return (
        <div className="space-y-2">
          <SelectInput label="차트유형" value={String(c.type || 'bar')} onChange={v => onChange('type', v)} options={[
            { value: 'bar', label: '막대' },
            { value: 'line', label: '라인' },
            { value: 'pie', label: '파이' },
            { value: 'doughnut', label: '도넛' },
          ]} />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-16">제목</label>
            <input
              type="text"
              value={String(c.title || '')}
              onChange={e => onChange('title', e.target.value)}
              className="flex-1 text-xs px-2 py-1 border rounded bg-gray-50"
            />
          </div>
          <ColorInput label="색상" value={String(c.color || '#FFFFFF')} onChange={v => onChange('color', v)} />
          <ColorInput label="배경색" value={String(c.bgColor || 'rgba(0,0,0,0.4)')} onChange={v => onChange('bgColor', v)} />
        </div>
      )

    default:
      return <p className="text-xs text-gray-400">설정 없음</p>
  }
}

// ─── 애니메이션 패널 ─────────────────────────
const ANIMATIONS = [
  { value: 'none', label: '없음' },
  { value: 'fadeIn', label: '페이드 인' },
  { value: 'fadeOut', label: '페이드 아웃' },
  { value: 'slideInLeft', label: '슬라이드 (왼쪽)' },
  { value: 'slideInRight', label: '슬라이드 (오른쪽)' },
  { value: 'slideInUp', label: '슬라이드 (위)' },
  { value: 'slideInDown', label: '슬라이드 (아래)' },
  { value: 'zoomIn', label: '줌 인' },
  { value: 'zoomOut', label: '줌 아웃' },
  { value: 'pulse', label: '펄스' },
  { value: 'bounce', label: '바운스' },
  { value: 'spin', label: '회전' },
  { value: 'shake', label: '흔들기' },
  { value: 'flip', label: '플립' },
]

const EASINGS = [
  { value: 'ease', label: 'Ease' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In-Out' },
  { value: 'linear', label: 'Linear' },
]

function AnimationPanel({ element, onUpdate }: { element: CanvasElement; onUpdate: (u: Partial<CanvasElement>) => void }) {
  const animation = (element as any).animation || {}

  const setAnim = (key: string, value: unknown) => {
    onUpdate({ animation: { ...animation, [key]: value } } as any)
  }

  return (
    <div className="space-y-2">
      <SelectInput
        label="입장"
        value={animation.enter || 'none'}
        onChange={v => setAnim('enter', v)}
        options={ANIMATIONS}
      />
      <SelectInput
        label="퇴장"
        value={animation.exit || 'none'}
        onChange={v => setAnim('exit', v)}
        options={ANIMATIONS}
      />
      <SelectInput
        label="반복"
        value={animation.loop || 'none'}
        onChange={v => setAnim('loop', v)}
        options={ANIMATIONS.filter(a => ['none', 'pulse', 'bounce', 'spin', 'shake'].includes(a.value))}
      />
      <NumberInput
        label="지연(초)"
        value={animation.delay || 0}
        onChange={v => setAnim('delay', v)}
        min={0} max={10} step={0.1}
      />
      <NumberInput
        label="시간(초)"
        value={animation.duration || 0.5}
        onChange={v => setAnim('duration', v)}
        min={0.1} max={5} step={0.1}
      />
      <SelectInput
        label="이징"
        value={animation.easing || 'ease'}
        onChange={v => setAnim('easing', v)}
        options={EASINGS}
      />
    </div>
  )
}

// ─── 위젯 이름 매핑 ──────────────────────────
const WIDGET_NAMES: Record<string, string> = {
  clock: '디지털 시계',
  weather: '날씨',
  rss: 'RSS 뉴스',
  qrcode: 'QR코드',
  video: '비디오',
  webpage: '웹페이지',
  spreadsheet: '스프레드시트',
  chart: '차트',
}

export default function RightPanel() {
  const [activeSection, setActiveSection] = useState<'props' | 'animation'>('props')
  const {
    selectedElementId, getCurrentPage,
    updateElement, deleteElement, duplicateElement,
    bringForward, sendBackward, bringToFront, sendToBack,
    canvasData, setCanvasBackground
  } = useCanvasStore()

  // Fetch fonts
  const { data: fonts } = useQuery({
    queryKey: ['fonts'],
    queryFn: fontApi.list
  })

  const page = getCurrentPage()
  const element = page.elements.find(el => el.id === selectedElementId)

  const update = (updates: Partial<CanvasElement>) => {
    if (selectedElementId) updateElement(selectedElementId, updates)
  }

  // No selection → show canvas settings
  if (!element) {
    return (
      <div className="w-64 bg-white border-l border-gray-200 flex-shrink-0 overflow-y-auto">
        <div className="p-3 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">캔버스 설정</h3>
        </div>
        <div className="p-3 space-y-3">
          <ColorInput
            label="배경색"
            value={canvasData.canvas.background}
            onChange={setCanvasBackground}
          />
          <div className="text-xs text-gray-400 mt-4">
            요소를 선택하면 속성을 편집할 수 있습니다
          </div>
        </div>
      </div>
    )
  }

  const elementTypeLabel =
    element.type === 'text' ? '텍스트' :
    element.type === 'shape' ? '도형' :
    element.type === 'image' ? '이미지' :
    element.type === 'widget' ? (WIDGET_NAMES[element.widget || ''] || '위젯') :
    '요소'

  // Font list for dropdown
  const allFonts = [
    ...(fonts?.system || []).map(f => f.family),
    ...(fonts?.custom || []).map(f => f.family),
  ]
  if (allFonts.length === 0) {
    allFonts.push('Noto Sans KR', 'Roboto', 'Arial', 'Georgia', 'Courier New')
  }

  return (
    <div className="w-64 bg-white border-l border-gray-200 flex-shrink-0 overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase">{elementTypeLabel}</h3>
        <div className="flex gap-0.5">
          <button onClick={() => duplicateElement(element.id)} className="p-1 text-gray-400 hover:text-blue-500 rounded" title="복제">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => deleteElement(element.id)} className="p-1 text-gray-400 hover:text-red-500 rounded" title="삭제">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveSection('props')}
          className={`flex-1 py-2 text-xs font-medium ${activeSection === 'props' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}
        >
          속성
        </button>
        <button
          onClick={() => setActiveSection('animation')}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 ${activeSection === 'animation' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}
        >
          <Sparkles className="w-3 h-3" />
          애니메이션
        </button>
      </div>

      <div className="p-3 space-y-4">
        {activeSection === 'animation' ? (
          <AnimationPanel element={element} onUpdate={update} />
        ) : (
          <>
            {/* Position & Size */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2">위치 & 크기</h4>
              <div className="grid grid-cols-2 gap-2">
                <NumberInput label="X" value={Math.round(element.x)} onChange={v => update({ x: v })} />
                <NumberInput label="Y" value={Math.round(element.y)} onChange={v => update({ y: v })} />
                <NumberInput label="W" value={Math.round(element.width)} onChange={v => update({ width: v })} min={1} />
                <NumberInput label="H" value={Math.round(element.height)} onChange={v => update({ height: v })} min={1} />
              </div>
              <div className="mt-2">
                <NumberInput label="회전" value={element.rotation || 0} onChange={v => update({ rotation: v })} min={0} max={360} />
              </div>
            </div>

            {/* Opacity */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2">투명도</h4>
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={element.opacity ?? 1}
                onChange={e => update({ opacity: Number(e.target.value) })}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{Math.round((element.opacity ?? 1) * 100)}%</span>
            </div>

            {/* Text properties */}
            {element.type === 'text' && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 mb-2">텍스트</h4>
                <textarea
                  value={element.content || ''}
                  onChange={e => update({ content: e.target.value })}
                  className="w-full text-xs p-2 border rounded bg-gray-50 resize-none"
                  rows={3}
                />
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 w-16">폰트</label>
                    <select
                      value={element.fontFamily || 'Noto Sans KR'}
                      onChange={e => update({ fontFamily: e.target.value })}
                      className="flex-1 text-xs px-2 py-1 border rounded bg-gray-50"
                    >
                      {[...new Set(allFonts)].map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <NumberInput label="크기" value={element.fontSize || 32} onChange={v => update({ fontSize: v })} min={8} max={200} />
                  <ColorInput label="색상" value={element.color || '#FFFFFF'} onChange={v => update({ color: v })} />

                  {/* Text formatting */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => update({ bold: !element.bold })}
                      className={`p-1.5 rounded ${element.bold ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-100'}`}
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => update({ italic: !element.italic })}
                      className={`p-1.5 rounded ${element.italic ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-100'}`}
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => update({ underline: !element.underline })}
                      className={`p-1.5 rounded ${element.underline ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-100'}`}
                    >
                      <Underline className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px bg-gray-200 mx-1" />
                    <button
                      onClick={() => update({ textAlign: 'left' })}
                      className={`p-1.5 rounded ${element.textAlign === 'left' ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-100'}`}
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => update({ textAlign: 'center' })}
                      className={`p-1.5 rounded ${element.textAlign === 'center' ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-100'}`}
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => update({ textAlign: 'right' })}
                      className={`p-1.5 rounded ${element.textAlign === 'right' ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-100'}`}
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Shape properties */}
            {element.type === 'shape' && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 mb-2">도형</h4>
                <div className="space-y-2">
                  <ColorInput label="채우기" value={element.fill || '#3B82F6'} onChange={v => update({ fill: v })} />
                  <ColorInput label="테두리" value={element.stroke || ''} onChange={v => update({ stroke: v })} />
                  <NumberInput label="두께" value={element.strokeWidth || 0} onChange={v => update({ strokeWidth: v })} min={0} max={20} />
                  {element.shape === 'rect' && (
                    <NumberInput label="둥글기" value={element.borderRadius || 0} onChange={v => update({ borderRadius: v })} min={0} max={100} />
                  )}
                </div>
              </div>
            )}

            {/* Image properties */}
            {element.type === 'image' && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 mb-2">이미지</h4>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500">이미지 URL</label>
                    <input
                      type="text"
                      value={element.src || ''}
                      onChange={e => update({ src: e.target.value })}
                      className="w-full text-xs px-2 py-1 border rounded bg-gray-50 mt-1"
                      placeholder="https://... 또는 /uploads/..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 w-16">맞춤</label>
                    <select
                      value={element.fit || 'cover'}
                      onChange={e => update({ fit: e.target.value as any })}
                      className="flex-1 text-xs px-2 py-1 border rounded bg-gray-50"
                    >
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                      <option value="fill">Fill</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Widget config */}
            {element.type === 'widget' && element.widget && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 mb-2">위젯 설정</h4>
                <WidgetConfigPanel
                  widget={element.widget}
                  config={(element.config || {}) as Record<string, unknown>}
                  onChange={(key, value) => {
                    update({
                      config: { ...(element.config || {}), [key]: value }
                    })
                  }}
                />
              </div>
            )}

            {/* Layer controls */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2">레이어</h4>
              <div className="flex gap-1">
                <button onClick={() => bringToFront(element.id)} className="flex-1 text-xs py-1.5 bg-gray-50 hover:bg-gray-100 rounded" title="맨 앞으로">
                  <ChevronsUp className="w-3.5 h-3.5 mx-auto" />
                </button>
                <button onClick={() => bringForward(element.id)} className="flex-1 text-xs py-1.5 bg-gray-50 hover:bg-gray-100 rounded" title="앞으로">
                  <ChevronUp className="w-3.5 h-3.5 mx-auto" />
                </button>
                <button onClick={() => sendBackward(element.id)} className="flex-1 text-xs py-1.5 bg-gray-50 hover:bg-gray-100 rounded" title="뒤로">
                  <ChevronDown className="w-3.5 h-3.5 mx-auto" />
                </button>
                <button onClick={() => sendToBack(element.id)} className="flex-1 text-xs py-1.5 bg-gray-50 hover:bg-gray-100 rounded" title="맨 뒤로">
                  <ChevronsDown className="w-3.5 h-3.5 mx-auto" />
                </button>
              </div>
            </div>

            {/* Lock/Visibility */}
            <div className="flex gap-2">
              <button
                onClick={() => update({ locked: !element.locked })}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded border ${element.locked ? 'bg-orange-50 border-orange-200 text-orange-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                {element.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                {element.locked ? '잠금' : '잠금해제'}
              </button>
              <button
                onClick={() => update({ visible: !(element.visible ?? true) })}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded border ${element.visible === false ? 'bg-gray-100 border-gray-300 text-gray-400' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                {element.visible === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {element.visible === false ? '숨김' : '표시'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
