import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Rnd } from 'react-rnd'
import {
  ArrowLeft, Plus, Trash2, Save, Layers, Image, Code,
  FileText, Eye, EyeOff, ChevronUp, ChevronDown, Copy, Monitor,
  ZoomIn, ZoomOut, Maximize2,
} from 'lucide-react'
import { layoutApi } from '@/api/layouts'
import { playlistApi } from '@/api/playlists'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

// Zone colors for visual distinction
const ZONE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1'
]

// 존 소스 유형: 플레이리스트 / URL / HTML 직접입력
const SOURCE_TYPES = [
  { value: 'PLAYLIST', label: '플레이리스트', icon: Image,   desc: '이미지·영상 파일을 순서대로 재생' },
  { value: 'URL',      label: 'URL 페이지',   icon: Monitor, desc: '웹페이지를 iframe으로 표시' },
  { value: 'HTML',     label: 'HTML 코드',    icon: Code,    desc: 'HTML을 직접 렌더링' },
]

// VueSign Phase W1: 캔버스 크기는 동적으로 조절 가능해졌다.
//   - canvasZoom 0.5 ~ 2.5 범위
//   - BASE_CANVAS_WIDTH 기준으로 실제 픽셀 폭을 계산
//   - "화면에 맞춤" 버튼은 현재 스크롤 영역 너비에 맞게 자동 조정
const BASE_CANVAS_WIDTH = 900
const MIN_ZOOM = 0.4
const MAX_ZOOM = 3.0
const ZOOM_STEP = 0.1

interface Zone {
  id: string
  name: string
  x: number      // percentage
  y: number
  width: number
  height: number
  zIndex: number
  contentType: string   // 'PLAYLIST' | 'URL' | 'HTML'
  playlistId: string | null
  sourceUrl: string     // URL 유형일 때 사용
  sourceHtml: string    // HTML 유형일 때 사용
  bgColor: string
  fit: string
  visible?: boolean  // UI only, not saved
}

interface LayoutData {
  id: string
  name: string
  baseWidth: number
  baseHeight: number
  zones: Zone[]
}

interface PlaylistOption {
  id: string
  name: string
}

export default function LayoutEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canvasRef = useRef<HTMLDivElement>(null)

  const canvasScrollRef = useRef<HTMLDivElement>(null)

  const [zones, setZones] = useState<Zone[]>([])
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [canvasZoom, setCanvasZoom] = useState(1.0)

  const { data: layout, isLoading } = useQuery<LayoutData>({
    queryKey: ['layout', id],
    queryFn: () => layoutApi.getById(id!),
    enabled: !!id,
  })

  // Load zones from server when layout first loads (not when user has local changes)
  useEffect(() => {
    if (layout && !hasChanges) {
      setZones(layout.zones.map((z: Zone) => ({ ...z, visible: true })))
    }
  }, [layout, hasChanges])

  const { data: playlistData } = useQuery({
    queryKey: ['playlists-for-layout'],
    queryFn: () => playlistApi.getAll({ limit: 100 }),
  })

  const saveMutation = useMutation({
    mutationFn: () => layoutApi.saveZones(id!, zones.map(z => ({
      name: z.name, x: z.x, y: z.y, width: z.width, height: z.height,
      zIndex: z.zIndex, contentType: z.contentType,
      playlistId: z.contentType === 'PLAYLIST' ? z.playlistId : null,
      sourceUrl: z.contentType === 'URL' ? z.sourceUrl : null,
      sourceHtml: z.contentType === 'HTML' ? z.sourceHtml : null,
      bgColor: z.bgColor, fit: z.fit,
    }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['layout', id] })
      queryClient.invalidateQueries({ queryKey: ['layouts'] })
      setHasChanges(false)
      toast.success('레이아웃이 저장되었습니다')
    },
    onError: () => toast.error('저장에 실패했습니다'),
  })

  // Canvas size in px based on aspect ratio and current zoom
  const canvasWidth = useMemo(
    () => Math.round(BASE_CANVAS_WIDTH * canvasZoom),
    [canvasZoom]
  )
  const canvasHeight = useMemo(
    () =>
      layout
        ? Math.round(canvasWidth * (layout.baseHeight / layout.baseWidth))
        : Math.round(canvasWidth * (9 / 16)),
    [canvasWidth, layout]
  )

  // Convert zone % to canvas px
  const toCanvas = useCallback(
    (zone: Zone) => ({
      x: (zone.x / 100) * canvasWidth,
      y: (zone.y / 100) * canvasHeight,
      width: (zone.width / 100) * canvasWidth,
      height: (zone.height / 100) * canvasHeight,
    }),
    [canvasWidth, canvasHeight]
  )

  // Convert canvas px back to %
  const toPercent = useCallback(
    (x: number, y: number, w: number, h: number) => ({
      x: Math.max(0, Math.min(100, parseFloat(((x / canvasWidth) * 100).toFixed(2)))),
      y: Math.max(0, Math.min(100, parseFloat(((y / canvasHeight) * 100).toFixed(2)))),
      width: Math.max(5, Math.min(100, parseFloat(((w / canvasWidth) * 100).toFixed(2)))),
      height: Math.max(5, Math.min(100, parseFloat(((h / canvasHeight) * 100).toFixed(2)))),
    }),
    [canvasWidth, canvasHeight]
  )

  // Zoom controls
  const zoomIn = useCallback(
    () => setCanvasZoom(z => Math.min(MAX_ZOOM, parseFloat((z + ZOOM_STEP).toFixed(2)))),
    []
  )
  const zoomOut = useCallback(
    () => setCanvasZoom(z => Math.max(MIN_ZOOM, parseFloat((z - ZOOM_STEP).toFixed(2)))),
    []
  )
  const zoomFit = useCallback(() => {
    if (!canvasScrollRef.current || !layout) return
    const availableWidth = canvasScrollRef.current.clientWidth - 64 // padding 32*2
    const availableHeight = canvasScrollRef.current.clientHeight - 64
    const ratio = layout.baseHeight / layout.baseWidth
    // 너비/높이 모두에 맞는 최대 zoom 선택
    const widthZoom = availableWidth / BASE_CANVAS_WIDTH
    const heightZoom = availableHeight / (BASE_CANVAS_WIDTH * ratio)
    const bestZoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, Math.min(widthZoom, heightZoom))
    )
    setCanvasZoom(parseFloat(bestZoom.toFixed(2)))
  }, [layout])

  // 레이아웃 로드 시 한 번 자동으로 화면에 맞춤
  useEffect(() => {
    if (layout) {
      // 다음 프레임에 실행 (DOM 크기 측정용)
      const t = setTimeout(zoomFit, 0)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout?.id])

  // 키보드 단축키: Ctrl+=/- 으로 줌, Ctrl+0 으로 맞춤
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '-') {
        e.preventDefault()
        zoomOut()
      } else if (e.key === '0') {
        e.preventDefault()
        zoomFit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [zoomIn, zoomOut, zoomFit])

  const addZone = useCallback(() => {
    const newZone: Zone = {
      id: `zone-${Date.now()}`,
      name: `Zone ${zones.length + 1}`,
      x: 10, y: 10, width: 40, height: 40,
      zIndex: zones.length + 1,
      contentType: 'PLAYLIST',
      playlistId: null,
      sourceUrl: '',
      sourceHtml: '',
      bgColor: ZONE_COLORS[zones.length % ZONE_COLORS.length],
      fit: 'cover',
      visible: true,
    }
    setZones(prev => [...prev, newZone])
    setSelectedZoneId(newZone.id)
    setHasChanges(true)
  }, [zones])

  const updateZone = useCallback((zoneId: string, updates: Partial<Zone>) => {
    setZones(prev => prev.map(z => z.id === zoneId ? { ...z, ...updates } : z))
    setHasChanges(true)
  }, [])

  const deleteZone = useCallback((zoneId: string) => {
    setZones(prev => prev.filter(z => z.id !== zoneId))
    if (selectedZoneId === zoneId) setSelectedZoneId(null)
    setHasChanges(true)
  }, [selectedZoneId])

  const duplicateZone = useCallback((zone: Zone) => {
    const copy: Zone = {
      ...zone,
      id: `zone-${Date.now()}`,
      name: `${zone.name} 복사`,
      x: Math.min(zone.x + 3, 100 - zone.width),
      y: Math.min(zone.y + 3, 100 - zone.height),
      zIndex: zones.length + 1,
    }
    setZones(prev => [...prev, copy])
    setSelectedZoneId(copy.id)
    setHasChanges(true)
  }, [zones])

  const moveZIndex = useCallback((zoneId: string, dir: 'up' | 'down') => {
    setZones(prev => prev.map(z => {
      if (z.id === zoneId) return { ...z, zIndex: dir === 'up' ? z.zIndex + 1 : Math.max(1, z.zIndex - 1) }
      return z
    }))
    setHasChanges(true)
  }, [])

  const selectedZone = zones.find(z => z.id === selectedZoneId)
  const playlists: PlaylistOption[] = playlistData?.items ?? []

  if (isLoading) return <PageLoader />
  if (!layout) return <div className="p-8 text-center text-gray-500">레이아웃을 찾을 수 없습니다</div>

  const sortedZones = [...zones].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-100">
      {/* ─── Top Bar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b shadow-sm flex-shrink-0">
        <button className="p-2 hover:bg-gray-100 rounded-lg" onClick={() => navigate('/layouts')}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-gray-800">{layout.name}</h1>
          <p className="text-xs text-gray-400">{layout.baseWidth}×{layout.baseHeight} · 존 {zones.length}개</p>
        </div>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border"
          onClick={() => setShowGrid(g => !g)}
        >
          {showGrid ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          그리드
        </button>

        {/* VueSign Phase W1: 캔버스 줌 컨트롤 */}
        <div className="flex items-center gap-0.5 border rounded-lg overflow-hidden">
          <button
            onClick={zoomOut}
            disabled={canvasZoom <= MIN_ZOOM}
            className="p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            title="축소 (Ctrl+-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="px-2 text-xs text-gray-600 w-12 text-center tabular-nums">
            {Math.round(canvasZoom * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={canvasZoom >= MAX_ZOOM}
            className="p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            title="확대 (Ctrl++)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={zoomFit}
            className="p-1.5 text-gray-500 hover:bg-gray-100 border-l"
            title="화면에 맞춤 (Ctrl+0)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          onClick={() => addZone()}
        >
          <Plus className="w-4 h-4" /> 존 추가
        </button>
        <button
          className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg font-medium transition-colors
            ${hasChanges ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          onClick={() => hasChanges && saveMutation.mutate()}
          disabled={!hasChanges || saveMutation.isPending}
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? '저장 중...' : hasChanges ? '저장' : '저장됨'}
        </button>
      </div>

      {/* ─── Main Area ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── Canvas ─────────────────────────────────────── */}
        <div
          ref={canvasScrollRef}
          className="flex-1 overflow-auto flex items-center justify-center p-8 bg-gray-200"
        >
          <div
            ref={canvasRef}
            className="relative bg-black shadow-2xl flex-shrink-0"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              backgroundImage: showGrid
                ? 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)'
                : 'none',
              backgroundSize: showGrid ? '40px 40px' : 'auto',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedZoneId(null)
            }}
          >
            {sortedZones.map((zone) => {
              if (zone.visible === false) return null
              const px = toCanvas(zone)
              const isSelected = zone.id === selectedZoneId
              const color = zone.bgColor || ZONE_COLORS[0]

              return (
                <Rnd
                  key={zone.id}
                  position={{ x: px.x, y: px.y }}
                  size={{ width: px.width, height: px.height }}
                  bounds="parent"
                  style={{ zIndex: zone.zIndex }}
                  onDragStop={(_e: unknown, d: { x: number; y: number }) => {
                    const pct = toPercent(d.x, d.y, px.width, px.height)
                    updateZone(zone.id, { x: pct.x, y: pct.y })
                  }}
                  onResizeStop={(_e: unknown, _dir: unknown, ref: HTMLElement, _delta: unknown, pos: { x: number; y: number }) => {
                    const pct = toPercent(pos.x, pos.y, ref.offsetWidth, ref.offsetHeight)
                    updateZone(zone.id, { x: pct.x, y: pct.y, width: pct.width, height: pct.height })
                  }}
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelectedZoneId(zone.id) }}
                  enableResizing
                  resizeHandleStyles={{
                    bottomRight: { width: 10, height: 10, right: 0, bottom: 0, cursor: 'se-resize' },
                    bottomLeft: { width: 10, height: 10, left: 0, bottom: 0, cursor: 'sw-resize' },
                    topRight: { width: 10, height: 10, right: 0, top: 0, cursor: 'ne-resize' },
                    topLeft: { width: 10, height: 10, left: 0, top: 0, cursor: 'nw-resize' },
                  }}
                >
                  <div
                    className={`w-full h-full relative select-none transition-all
                      ${isSelected ? 'ring-2 ring-offset-0 ring-white' : 'ring-1 ring-white/20'}`}
                    style={{ backgroundColor: color + '55', border: `2px solid ${color}` }}
                  >
                    {/* Zone label */}
                    <div
                      className="absolute top-0 left-0 right-0 px-2 py-0.5 text-white text-xs font-bold truncate"
                      style={{ backgroundColor: color + 'dd', fontSize: 11 }}
                    >
                      {zone.name} · z:{zone.zIndex}
                    </div>

                    {/* Source type icon */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-60">
                      {(() => {
                        const ST = SOURCE_TYPES.find(t => t.value === zone.contentType)
                        const Icon = ST?.icon || FileText
                        return <Icon className="text-white" style={{ width: Math.min(px.width, px.height) * 0.3, height: Math.min(px.width, px.height) * 0.3 }} />
                      })()}
                    </div>

                    {/* Playlist name */}
                    {zone.playlistId && (
                      <div className="absolute bottom-0 left-0 right-0 px-2 py-0.5 text-white text-[10px] truncate"
                        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                        {playlists.find((p) => p.id === zone.playlistId)?.name || '플레이리스트'}
                      </div>
                    )}

                    {/* Resize corners visual */}
                    {isSelected && (
                      <>
                        {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map(pos => (
                          <div key={pos} className={`absolute w-2.5 h-2.5 bg-white rounded-full ${pos}`} style={{ margin: -4 }} />
                        ))}
                      </>
                    )}
                  </div>
                </Rnd>
              )
            })}
          </div>
        </div>

        {/* ─── Right Panel ─────────────────────────────────── */}
        <div className="w-72 bg-white border-l flex flex-col overflow-hidden">

          {/* Zone List */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">존 목록</span>
              <span className="ml-auto text-xs text-gray-400">{zones.length}개</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {[...zones].sort((a, b) => b.zIndex - a.zIndex).map(zone => (
                <div
                  key={zone.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors
                    ${zone.id === selectedZoneId ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
                  onClick={() => setSelectedZoneId(zone.id)}
                >
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: zone.bgColor || '#3b82f6' }} />
                  <span className="flex-1 truncate text-xs font-medium">{zone.name}</span>
                  <span className="text-[10px] text-gray-400">z:{zone.zIndex}</span>
                  <button
                    className="p-0.5 hover:text-red-500 text-gray-300 transition-colors"
                    onClick={(e) => { e.stopPropagation(); deleteZone(zone.id) }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {zones.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">존이 없습니다. 존 추가를 클릭하세요.</p>
              )}
            </div>
          </div>

          {/* Zone Properties */}
          <div className="flex-1 overflow-y-auto p-4">
            {!selectedZone ? (
              <div className="text-center py-8">
                <Layers className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">존을 선택하면 속성을 편집할 수 있습니다</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: selectedZone.bgColor || '#3b82f6' }} />
                  <h3 className="text-sm font-bold text-gray-800 flex-1 truncate">{selectedZone.name}</h3>
                </div>

                {/* Name */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">존 이름</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={selectedZone.name}
                    onChange={e => updateZone(selectedZone.id, { name: e.target.value })}
                  />
                </div>

                {/* Position & Size */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">위치 및 크기 (%)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'X', key: 'x' as const },
                      { label: 'Y', key: 'y' as const },
                      { label: 'W', key: 'width' as const },
                      { label: 'H', key: 'height' as const },
                    ].map(({ label, key }) => (
                      <div key={key} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                        <span className="text-[10px] font-bold text-gray-400 w-4">{label}</span>
                        <input
                          type="number"
                          className="flex-1 bg-transparent text-xs text-gray-700 focus:outline-none w-full"
                          value={Number(selectedZone[key]).toFixed(1)}
                          min={0} max={100} step={0.5}
                          onChange={e => updateZone(selectedZone.id, { [key]: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="text-[10px] text-gray-300">%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Z-Index / Layer */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">레이어 (z-index)</label>
                  <div className="flex items-center gap-2">
                    <button
                      className="p-1.5 border rounded-lg hover:bg-gray-50 transition-colors"
                      onClick={() => moveZIndex(selectedZone.id, 'down')}
                      title="아래 레이어로"
                    >
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    </button>
                    <div className="flex-1 text-center font-bold text-gray-700 bg-gray-50 border rounded-lg py-1.5 text-sm">
                      {selectedZone.zIndex}
                    </div>
                    <button
                      className="p-1.5 border rounded-lg hover:bg-gray-50 transition-colors"
                      onClick={() => moveZIndex(selectedZone.id, 'up')}
                      title="위 레이어로"
                    >
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">숫자가 클수록 위에 표시됩니다 (오버레이)</p>
                </div>

                {/* Source Type 선택 */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">콘텐츠 소스</label>
                  <div className="space-y-1.5">
                    {SOURCE_TYPES.map(({ value, label, icon: Icon, desc }) => (
                      <button
                        key={value}
                        className={`w-full flex items-center gap-3 px-3 py-2 border rounded-lg text-left transition-colors
                          ${selectedZone.contentType === value
                            ? 'bg-blue-50 border-blue-400 text-blue-700'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        onClick={() => updateZone(selectedZone.id, { contentType: value })}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <div>
                          <div className="text-xs font-medium">{label}</div>
                          <div className="text-[10px] text-gray-400">{desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 소스 유형별 입력 */}
                {selectedZone.contentType === 'PLAYLIST' && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">플레이리스트 선택</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                      value={selectedZone.playlistId || ''}
                      onChange={e => updateZone(selectedZone.id, { playlistId: e.target.value || null })}
                    >
                      <option value="">-- 선택하세요 --</option>
                      {playlists.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {!selectedZone.playlistId && (
                      <p className="text-[10px] text-amber-500 mt-1">⚠ 플레이리스트를 선택해야 재생됩니다</p>
                    )}
                  </div>
                )}

                {selectedZone.contentType === 'URL' && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">웹페이지 URL</label>
                    <input
                      type="url"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="https://example.com"
                      value={selectedZone.sourceUrl || ''}
                      onChange={e => updateZone(selectedZone.id, { sourceUrl: e.target.value })}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">입력한 URL을 iframe으로 표시합니다</p>
                  </div>
                )}

                {selectedZone.contentType === 'HTML' && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">HTML 코드</label>
                    <textarea
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={6}
                      placeholder={'<div style="color:white; font-size:48px">\n  안녕하세요\n</div>'}
                      value={selectedZone.sourceHtml || ''}
                      onChange={e => updateZone(selectedZone.id, { sourceHtml: e.target.value })}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">입력한 HTML을 해당 구역에 직접 렌더링합니다</p>
                  </div>
                )}

                {/* Fit */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">콘텐츠 맞춤</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                    value={selectedZone.fit || 'contain'}
                    onChange={e => updateZone(selectedZone.id, { fit: e.target.value })}
                  >
                    <option value="contain">Contain (전체 표시)</option>
                    <option value="cover">Cover (꽉 채움)</option>
                    <option value="fill">Fill (늘리기)</option>
                  </select>
                </div>

                {/* Background Color */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">배경 색상</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedZone.bgColor || '#000000'}
                      onChange={e => updateZone(selectedZone.id, { bgColor: e.target.value })}
                      className="w-10 h-8 rounded border border-gray-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={selectedZone.bgColor || '#000000'}
                      onChange={e => updateZone(selectedZone.id, { bgColor: e.target.value })}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs border rounded-lg hover:bg-gray-50 text-gray-600"
                    onClick={() => duplicateZone(selectedZone)}
                  >
                    <Copy className="w-3.5 h-3.5" /> 복제
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs border border-red-200 rounded-lg hover:bg-red-50 text-red-500"
                    onClick={() => deleteZone(selectedZone.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 삭제
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
