import { clsx } from 'clsx'

interface StatusBadgeProps {
  status: string
  className?: string
}

const statusConfig: Record<string, { label: string; class: string }> = {
  ONLINE: { label: '온라인', class: 'badge-success' },
  OFFLINE: { label: '오프라인', class: 'badge-danger' },
  WARNING: { label: '경고', class: 'badge-warning' },
  ACTIVE: { label: '활성', class: 'badge-success' },
  DRAFT: { label: '초안', class: 'badge-gray' },
  PAUSED: { label: '일시정지', class: 'badge-warning' },
  CANCELLED: { label: '취소됨', class: 'badge-danger' },
  DEPLOYED: { label: '배포됨', class: 'badge-success' },
  PENDING: { label: '대기', class: 'badge-warning' },
  FAILED: { label: '실패', class: 'badge-danger' },
  GENERAL: { label: '일반', class: 'badge-info' },
  NESTED: { label: '중첩', class: 'badge-info' },
  TAG: { label: '태그', class: 'badge-info' },
  VIDEOWALL: { label: '비디오월', class: 'badge-info' },
  SYNCHRONIZED: { label: '동기화', class: 'badge-info' },
  AUDIENCE: { label: '시청자지정', class: 'badge-info' },
  ADVERTISEMENT: { label: '광고', class: 'badge-info' },
  IMAGE: { label: '이미지', class: 'badge-info' },
  VIDEO: { label: '비디오', class: 'badge-warning' },
  AUDIO: { label: '오디오', class: 'badge-gray' },
  HTML: { label: 'HTML', class: 'badge-success' },
  DOCUMENT: { label: '문서', class: 'badge-gray' },
  SUPER_ADMIN: { label: '최고관리자', class: 'badge-danger' },
  TENANT_ADMIN: { label: '업체관리자', class: 'badge-warning' },
  STORE_MANAGER: { label: '매장관리자', class: 'badge-info' },
  ADMIN: { label: '업체관리자', class: 'badge-danger' },
  USER: { label: '사용자', class: 'badge-info' },
  VIEWER: { label: '뷰어', class: 'badge-gray' },
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, class: 'badge-gray' }

  return (
    <span className={clsx(config.class, className)}>
      {config.label}
    </span>
  )
}
