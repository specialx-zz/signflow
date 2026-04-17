// Day-of-week toggle picker used when repeatType === 'WEEKLY'
// Values are string indices: '0' = Sun, '1' = Mon, ..., '6' = Sat

interface DayOfWeekPickerProps {
  value: string[]
  onChange: (days: string[]) => void
  error?: string
}

const DAYS = [
  { value: '1', label: '월' },
  { value: '2', label: '화' },
  { value: '3', label: '수' },
  { value: '4', label: '목' },
  { value: '5', label: '금' },
  { value: '6', label: '토' },
  { value: '0', label: '일' },
]

export default function DayOfWeekPicker({ value, onChange, error }: DayOfWeekPickerProps) {
  const toggle = (day: string) => {
    if (value.includes(day)) {
      onChange(value.filter(d => d !== day))
    } else {
      onChange([...value, day])
    }
  }

  return (
    <div>
      <div className="flex gap-1">
        {DAYS.map(day => {
          const selected = value.includes(day.value)
          return (
            <button
              key={day.value}
              type="button"
              onClick={() => toggle(day.value)}
              className={
                selected
                  ? 'w-8 h-8 text-xs font-medium rounded-full bg-indigo-600 text-white'
                  : 'w-8 h-8 text-xs font-medium rounded-full border border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-500'
              }
            >
              {day.label}
            </button>
          )
        })}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
