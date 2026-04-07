import React from 'react'

interface DownloadingOverlayProps {
  filename: string
  percent: number      // 0~100
  received: number     // bytes
  total: number        // bytes (0이면 미확인)
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function DownloadingOverlay({
  filename,
  percent,
  received,
  total,
}: DownloadingOverlayProps) {
  const isIndeterminate = total === 0

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '20px',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* 아이콘 */}
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(0,120,255,0.8) 0%, rgba(0,180,255,0.6) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 30px rgba(0,120,255,0.3)',
          animation: 'pulse 2s ease-in-out infinite',
        }}
      >
        {/* 다운로드 화살표 아이콘 */}
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>

      {/* 텍스트 */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '15px', fontWeight: '500', margin: '0 0 4px' }}>
          콘텐츠 다운로드 중
        </p>
        <p style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: '12px',
          margin: 0,
          maxWidth: '300px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {filename}
        </p>
      </div>

      {/* 프로그레스바 */}
      <div style={{ width: '280px' }}>
        <div
          style={{
            width: '100%',
            height: '4px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: '2px',
              background: 'linear-gradient(90deg, #0078ff, #00d4ff)',
              transition: 'width 0.3s ease',
              width: isIndeterminate ? '40%' : `${percent}%`,
              animation: isIndeterminate ? 'indeterminate 1.4s ease-in-out infinite' : 'none',
            }}
          />
        </div>

        {/* 진행률 수치 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'monospace' }}>
            {isIndeterminate
              ? '다운로드 중...'
              : `${formatBytes(received)} / ${formatBytes(total)}`
            }
          </span>
          <span style={{ color: 'rgba(0,180,255,0.8)', fontSize: '11px', fontWeight: '600', fontFamily: 'monospace' }}>
            {isIndeterminate ? '' : `${percent}%`}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 30px rgba(0,120,255,0.3); }
          50% { box-shadow: 0 0 50px rgba(0,120,255,0.6); }
        }
        @keyframes indeterminate {
          0% { transform: translateX(-100%); width: 40%; }
          100% { transform: translateX(350%); width: 40%; }
        }
      `}</style>
    </div>
  )
}
