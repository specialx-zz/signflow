/**
 * V4 Phase 16: 차트 위젯
 * SVG 기반 간단한 데이터 시각화
 */

interface Props {
  config?: {
    type?: 'bar' | 'line' | 'pie' | 'doughnut'
    data?: { label: string; value: number; color?: string }[]
    title?: string
    bgColor?: string
    color?: string
  }
  width?: number
  height?: number
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316']

// 데모 데이터
const demoData = [
  { label: '1월', value: 65, color: COLORS[0] },
  { label: '2월', value: 45, color: COLORS[1] },
  { label: '3월', value: 80, color: COLORS[2] },
  { label: '4월', value: 55, color: COLORS[3] },
  { label: '5월', value: 90, color: COLORS[4] },
  { label: '6월', value: 70, color: COLORS[5] },
]

export default function ChartWidget({ config = {}, width = 400, height = 300 }: Props) {
  const chartType = config.type || 'bar'
  const data = (config.data && config.data.length > 0) ? config.data : demoData
  const title = config.title || ''
  const bgColor = config.bgColor || 'rgba(0,0,0,0.4)'
  const textColor = config.color || '#FFFFFF'

  const maxVal = Math.max(...data.map(d => d.value), 1)
  const padding = 40
  const chartW = width - padding * 2
  const titleH = title ? 30 : 0
  const chartH = height - padding - titleH - 30

  const renderBarChart = () => {
    const barW = Math.max(10, (chartW / data.length) * 0.6)
    const gap = chartW / data.length

    return (
      <g>
        {data.map((d, i) => {
          const barH = (d.value / maxVal) * chartH
          const x = padding + i * gap + (gap - barW) / 2
          const y = titleH + padding + chartH - barH
          return (
            <g key={i}>
              <rect
                x={x} y={y}
                width={barW} height={barH}
                fill={d.color || COLORS[i % COLORS.length]}
                rx={2}
              />
              <text
                x={x + barW / 2} y={height - 10}
                fill={textColor} fontSize={10} textAnchor="middle" fontFamily="Noto Sans KR"
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </g>
    )
  }

  const renderLineChart = () => {
    const gap = chartW / Math.max(data.length - 1, 1)
    const points = data.map((d, i) => ({
      x: padding + i * gap,
      y: titleH + padding + chartH - (d.value / maxVal) * chartH
    }))
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

    return (
      <g>
        <path d={pathD} fill="none" stroke={COLORS[0]} strokeWidth={2.5} />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill={COLORS[0]} />
            <text
              x={p.x} y={height - 10}
              fill={textColor} fontSize={10} textAnchor="middle" fontFamily="Noto Sans KR"
            >
              {data[i].label}
            </text>
          </g>
        ))}
      </g>
    )
  }

  const renderPieChart = () => {
    const cx = width / 2
    const cy = (height + titleH) / 2
    const r = Math.min(chartW, chartH) / 2 - 10
    const innerR = chartType === 'doughnut' ? r * 0.55 : 0
    const total = data.reduce((s, d) => s + d.value, 0)
    let startAngle = -90

    return (
      <g>
        {data.map((d, i) => {
          const angle = (d.value / total) * 360
          const endAngle = startAngle + angle
          const startRad = (startAngle * Math.PI) / 180
          const endRad = (endAngle * Math.PI) / 180
          const largeArc = angle > 180 ? 1 : 0

          const outerX1 = cx + r * Math.cos(startRad)
          const outerY1 = cy + r * Math.sin(startRad)
          const outerX2 = cx + r * Math.cos(endRad)
          const outerY2 = cy + r * Math.sin(endRad)

          let path: string
          if (innerR > 0) {
            const innerX1 = cx + innerR * Math.cos(startRad)
            const innerY1 = cy + innerR * Math.sin(startRad)
            const innerX2 = cx + innerR * Math.cos(endRad)
            const innerY2 = cy + innerR * Math.sin(endRad)
            path = `M ${outerX1} ${outerY1} A ${r} ${r} 0 ${largeArc} 1 ${outerX2} ${outerY2} L ${innerX2} ${innerY2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerX1} ${innerY1} Z`
          } else {
            path = `M ${cx} ${cy} L ${outerX1} ${outerY1} A ${r} ${r} 0 ${largeArc} 1 ${outerX2} ${outerY2} Z`
          }

          startAngle = endAngle
          return (
            <path
              key={i}
              d={path}
              fill={d.color || COLORS[i % COLORS.length]}
              stroke={bgColor}
              strokeWidth={1}
            />
          )
        })}
      </g>
    )
  }

  return (
    <div
      style={{
        width, height,
        backgroundColor: bgColor,
        borderRadius: 8,
        overflow: 'hidden'
      }}
    >
      <svg width={width} height={height}>
        {title && (
          <text
            x={width / 2} y={24}
            fill={textColor} fontSize={14} textAnchor="middle" fontWeight="bold" fontFamily="Noto Sans KR"
          >
            {title}
          </text>
        )}
        {chartType === 'bar' && renderBarChart()}
        {chartType === 'line' && renderLineChart()}
        {(chartType === 'pie' || chartType === 'doughnut') && renderPieChart()}
      </svg>
    </div>
  )
}

export const chartWidgetDefaults = {
  type: 'bar' as const,
  data: [] as { label: string; value: number; color?: string }[],
  title: '',
  bgColor: 'rgba(0,0,0,0.4)',
  color: '#FFFFFF'
}
