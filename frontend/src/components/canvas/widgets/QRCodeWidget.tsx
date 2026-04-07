/**
 * QR코드 생성 위젯
 * 외부 라이브러리 없이 Google Charts API 활용
 */

interface Props {
  config?: {
    url?: string
    size?: number
    bgColor?: string
    fgColor?: string
    label?: string
    labelColor?: string
  }
  width?: number
  height?: number
}

export default function QRCodeWidget({ config = {}, width = 150, height = 180 }: Props) {
  const url = config.url || 'https://signflow.app'
  const size = config.size || Math.min(width, height - 30)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=${(config.bgColor || 'FFFFFF').replace('#', '')}&color=${(config.fgColor || '000000').replace('#', '')}`

  return (
    <div
      style={{
        width, height,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 4
      }}
    >
      <img
        src={qrUrl}
        alt="QR Code"
        style={{
          width: size, height: size,
          borderRadius: 4,
          backgroundColor: config.bgColor || '#FFFFFF',
          padding: 4
        }}
      />
      {config.label && (
        <span style={{
          fontSize: 12,
          color: config.labelColor || '#FFFFFF',
          fontFamily: 'Noto Sans KR',
          textAlign: 'center'
        }}>
          {config.label}
        </span>
      )}
    </div>
  )
}

export const qrcodeWidgetDefaults = {
  url: 'https://signflow.app',
  size: 120,
  bgColor: '#FFFFFF',
  fgColor: '#000000',
  label: '',
  labelColor: '#FFFFFF'
}
