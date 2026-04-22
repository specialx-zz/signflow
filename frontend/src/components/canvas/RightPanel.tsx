/**
 * VueSign Phase W1: Canvas v2.0 Right Panel
 *
 * 선택된 요소가 없을 때: 캔버스 설정 (배경색/배경이미지/크기)
 * 선택된 요소가 있을 때:
 *   - 공통: 위치/크기/회전/투명도/레이어/잠금/표시
 *   - 텍스트: 내용, 폰트, 크기, 색상, 굵게/기울임/밑줄, 정렬
 *   - 이미지: URL, fit
 *   - 위젯: 위치(WeatherLocation) 선택 + 위젯별 옵션(색상/폰트/등등)
 */
import { useCanvasStore } from '@/store/canvasStore'
import { CanvasElement, WidgetKey, WidgetConfig } from '@/api/canvas'
import { useQuery } from '@tanstack/react-query'
import { fontApi } from '@/api/fonts'
import {
  Trash2, Copy, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown,
  Lock, Unlock, Eye, EyeOff, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Underline, ImageIcon,
} from 'lucide-react'
import LocationPicker from './LocationPicker'
import { WEATHER_WIDGET_LABELS } from './widgets/WeatherWidgets'

// ─── 공통 입력 컴포넌트 ────────────────────────
function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-16">{label}</label>
      <input
        type="color"
        value={value || '#000000'}
        onChange={e => onChange(e.target.value)}
        className="w-7 h-7 rounded border cursor-pointer"
      />
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

function TextInput({ value, onChange, label, placeholder }: {
  value: string; onChange: (v: string) => void; label: string; placeholder?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-16">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
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

// ─── 위젯 설정 패널 ────────────────────────────
function WidgetConfigPanel({
  widget, config, onChange,
}: {
  widget: WidgetKey
  config: WidgetConfig
  onChange: (config: WidgetConfig) => void
}) {
  const set = (patch: Partial<WidgetConfig>) => onChange({ ...config, ...patch })

  const common = (
    <>
      <LocationPicker value={config.locationId} onChange={id => set({ locationId: id })} />
      <ColorInput label="글자색" value={config.textColor || '#FFFFFF'} onChange={v => set({ textColor: v })} />
    </>
  )

  const isAirMetricWidget = widget === 'air.pm.value' || widget === 'air.pm.grade' || widget === 'air.pm.card'

  return (
    <div className="space-y-2">
      {common}

      {isAirMetricWidget && (
        <SelectInput
          label="지표"
          value={config.metric || 'pm25'}
          onChange={v => set({ metric: v as 'pm10' | 'pm25' })}
          options={[
            { value: 'pm10', label: 'PM10 (미세)' },
            { value: 'pm25', label: 'PM2.5 (초미세)' },
          ]}
        />
      )}

      {(widget === 'weather.current' || widget === 'weather.weekly' || widget === 'air.pm.card') && (
        <ColorInput label="배경" value={config.bgColor || 'rgba(15,23,42,0.55)'} onChange={v => set({ bgColor: v })} />
      )}

      {widget === 'weather.weekly' && (
        <NumberInput label="일 수" value={config.days || 7} onChange={v => set({ days: v })} min={3} max={10} />
      )}

      {(widget === 'weather.current.temp' || widget === 'weather.today.minmax' || widget === 'weather.location' || widget === 'air.pm.value' || widget === 'air.pm.grade') && (
        <NumberInput label="글자 크기" value={config.fontSize || 32} onChange={v => set({ fontSize: v })} min={10} max={200} />
      )}

      {widget === 'weather.current' && (
        <div className="space-y-1 pt-2 border-t border-gray-100">
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input type="checkbox" checked={config.showIcon !== false} onChange={e => set({ showIcon: e.target.checked })} />
            아이콘 표시
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input type="checkbox" checked={config.showLocation !== false} onChange={e => set({ showLocation: e.target.checked })} />
            위치 표시
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input type="checkbox" checked={config.showMinMax !== false} onChange={e => set({ showMinMax: e.target.checked })} />
            최고/최저 표시
          </label>
        </div>
      )}
    </div>
  )
}

// ─── 메인 RightPanel ────────────────────────────
export default function RightPanel() {
  const {
    selectedElementId, canvasData,
    updateElement, deleteElement, duplicateElement,
    bringForward, sendBackward, bringToFront, sendToBack,
    setCanvasBackgroundColor, setCanvasBackgroundImage, setCanvasBackgroundFit,
    setCanvasSize,
  } = useCanvasStore()

  const { data: fonts } = useQuery({
    queryKey: ['fonts'],
    queryFn: fontApi.list,
  })

  const element = canvasData.elements.find(el => el.id === selectedElementId)

  const update = (updates: Partial<CanvasElement>) => {
    if (selectedElementId) updateElement(selectedElementId, updates)
  }

  // ─── No selection: Canvas Settings ───────
  if (!element) {
    return (
      <div className="w-72 bg-white border-l border-gray-200 flex-shrink-0 overflow-y-auto">
        <div className="p-3 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">캔버스 설정</h3>
        </div>
        <div className="p-3 space-y-4">
          {/* 크기 */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 mb-2">크기</h4>
            <div className="grid grid-cols-2 gap-2">
              <NumberInput label="가로" value={canvasData.canvas.width} onChange={v => setCanvasSize(v, canvasData.canvas.height)} min={320} max={7680} />
              <NumberInput label="세로" value={canvasData.canvas.height} onChange={v => setCanvasSize(canvasData.canvas.width, v)} min={320} max={4320} />
            </div>
            <div className="flex gap-1 mt-2">
              <button onClick={() => setCanvasSize(1920, 1080)} className="flex-1 text-[10px] py-1 rounded bg-gray-100 hover:bg-gray-200">1920×1080</button>
              <button onClick={() => setCanvasSize(1080, 1920)} className="flex-1 text-[10px] py-1 rounded bg-gray-100 hover:bg-gray-200">1080×1920</button>
              <button onClick={() => setCanvasSize(3840, 2160)} className="flex-1 text-[10px] py-1 rounded bg-gray-100 hover:bg-gray-200">4K</button>
            </div>
          </div>

          {/* 배경색 */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 mb-2">배경색</h4>
            <ColorInput
              label="색상"
              value={canvasData.canvas.backgroundColor}
              onChange={setCanvasBackgroundColor}
            />
          </div>

          {/* 배경 이미지 */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> 배경 이미지
            </h4>
            <TextInput
              label="URL"
              value={canvasData.canvas.backgroundImage || ''}
              onChange={v => setCanvasBackgroundImage(v || undefined)}
              placeholder="/uploads/images/..."
            />
            {canvasData.canvas.backgroundImage && (
              <>
                <div className="mt-2">
                  <SelectInput
                    label="맞춤"
                    value={canvasData.canvas.backgroundFit || 'cover'}
                    onChange={v => setCanvasBackgroundFit(v as 'contain' | 'cover' | 'fill')}
                    options={[
                      { value: 'cover', label: '채우기(Cover)' },
                      { value: 'contain', label: '맞추기(Contain)' },
                      { value: 'fill', label: '늘이기(Fill)' },
                    ]}
                  />
                </div>
                <button
                  onClick={() => setCanvasBackgroundImage(undefined)}
                  className="mt-2 w-full text-xs py-1.5 text-red-500 hover:bg-red-50 rounded"
                >
                  배경 이미지 제거
                </button>
              </>
            )}
          </div>

          <div className="text-xs text-gray-400 leading-relaxed pt-2 border-t border-gray-100">
            💡 배경 이미지를 깔고 그 위에 날씨/대기질 위젯을 배치하면, 플레이어에서 실시간 데이터가 이미지 위에 덧붙여 표시됩니다.
          </div>
        </div>
      </div>
    )
  }

  // ─── Element selected ───────────────────
  const allFonts = [
    ...(fonts?.system || []).map((f: any) => f.family),
    ...(fonts?.custom || []).map((f: any) => f.family),
  ]
  if (allFonts.length === 0) {
    allFonts.push('Noto Sans KR', 'Roboto', 'Arial', 'Georgia', 'Courier New')
  }

  const elementTypeLabel =
    element.type === 'text' ? '텍스트' :
    element.type === 'image' ? '이미지' :
    element.type === 'widget' ? (WEATHER_WIDGET_LABELS[element.widget as WidgetKey] || '위젯') :
    '요소'

  return (
    <div className="w-72 bg-white border-l border-gray-200 flex-shrink-0 overflow-y-auto">
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

      <div className="p-3 space-y-4">
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
            <NumberInput label="회전" value={element.rotation || 0} onChange={v => update({ rotation: v })} min={-360} max={360} />
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
                  {[...new Set(allFonts)].map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <NumberInput label="크기" value={element.fontSize || 32} onChange={v => update({ fontSize: v })} min={8} max={400} />
              <ColorInput label="색상" value={element.color || '#FFFFFF'} onChange={v => update({ color: v })} />

              <div className="flex gap-1">
                <button onClick={() => update({ bold: !element.bold })} className={`p-1.5 rounded ${element.bold ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-100'}`}>
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => update({ italic: !element.italic })} className={`p-1.5 rounded ${element.italic ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-100'}`}>
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => update({ underline: !element.underline })} className={`p-1.5 rounded ${element.underline ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-100'}`}>
                  <Underline className="w-3.5 h-3.5" />
                </button>
                <div className="w-px bg-gray-200 mx-1" />
                <button onClick={() => update({ textAlign: 'left' })} className={`p-1.5 rounded ${element.textAlign === 'left' ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-100'}`}>
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => update({ textAlign: 'center' })} className={`p-1.5 rounded ${element.textAlign === 'center' ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-100'}`}>
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => update({ textAlign: 'right' })} className={`p-1.5 rounded ${element.textAlign === 'right' ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-100'}`}>
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <TextInput
                label="그림자"
                value={element.textShadow || ''}
                onChange={v => update({ textShadow: v || undefined })}
                placeholder="2px 2px 4px rgba(0,0,0,0.6)"
              />
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
              <SelectInput
                label="맞춤"
                value={element.fit || 'cover'}
                onChange={v => update({ fit: v as 'contain' | 'cover' | 'fill' })}
                options={[
                  { value: 'cover', label: 'Cover' },
                  { value: 'contain', label: 'Contain' },
                  { value: 'fill', label: 'Fill' },
                ]}
              />
            </div>
          </div>
        )}

        {/* Widget config */}
        {element.type === 'widget' && element.widget && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 mb-2">위젯 설정</h4>
            <WidgetConfigPanel
              widget={element.widget}
              config={(element.config || {}) as WidgetConfig}
              onChange={config => update({ config })}
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
      </div>
    </div>
  )
}
