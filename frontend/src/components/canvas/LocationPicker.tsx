/**
 * VueSign Phase W1: 위치 선택기
 *
 * 날씨/대기질 위젯이 참조할 WeatherLocation.id를 선택하는 컴포넌트.
 * 간단한 검색 입력 + 드롭다운 리스트.
 */
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { weatherApi, WeatherLocationLite } from '@/api/weather'
import { MapPin, Search } from 'lucide-react'

interface LocationPickerProps {
  value?: string
  onChange: (locationId: string) => void
  label?: string
}

export default function LocationPicker({ value, onChange, label = '위치' }: LocationPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  // 전체 위치를 한 번만 가져와서 클라이언트 필터링
  const { data, isLoading } = useQuery({
    queryKey: ['weather.locations'],
    queryFn: () => weatherApi.listLocations(),
    staleTime: 60 * 60 * 1000,
  })

  const all = data?.locations || []
  const selected = useMemo(() => all.find(l => l.id === value), [all, value])

  const filtered = useMemo(() => {
    if (!query.trim()) return all.slice(0, 50)
    const term = query.trim()
    return all
      .filter(l =>
        l.displayName.includes(term) ||
        l.sido.includes(term) ||
        l.sigungu.includes(term) ||
        (l.searchKey || '').includes(term)
      )
      .slice(0, 50)
  }, [all, query])

  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2 text-xs px-2 py-1.5 border rounded bg-gray-50 hover:bg-gray-100 text-left"
        >
          <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="flex-1 truncate">
            {selected ? selected.displayName : '선택되지 않음'}
          </span>
        </button>

        {open && (
          <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
            <div className="sticky top-0 bg-white p-2 border-b border-gray-100">
              <div className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="시/구 검색 (예: 강남)"
                  className="flex-1 text-xs outline-none bg-transparent"
                />
              </div>
            </div>
            {isLoading && (
              <div className="p-3 text-xs text-gray-400 text-center">로딩 중…</div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="p-3 text-xs text-gray-400 text-center">결과 없음</div>
            )}
            {!isLoading && filtered.map((loc: WeatherLocationLite) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => {
                  onChange(loc.id)
                  setOpen(false)
                  setQuery('')
                }}
                className={`w-full text-left text-xs px-3 py-1.5 hover:bg-blue-50 ${value === loc.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
              >
                {loc.displayName}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
