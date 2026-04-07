import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle, XCircle, Clock, Filter, MessageSquare,
  FileCheck, Image, Film, Music, FileText, X
} from 'lucide-react'
import { approvalsApi, type ContentApproval } from '@/api/approvals'

const STATUS_CONFIG = {
  PENDING: { label: '대기', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  APPROVED: { label: '승인', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  REJECTED: { label: '거부', color: 'bg-red-100 text-red-700', icon: XCircle },
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  IMAGE: Image, VIDEO: Film, AUDIO: Music, DOCUMENT: FileText,
}

export default function ApprovalsPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [page, setPage] = useState(1)
  const [rejectDialog, setRejectDialog] = useState<{ id: string } | null>(null)
  const [rejectComment, setRejectComment] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['approvals', statusFilter, page],
    queryFn: () => approvalsApi.getAll({
      status: statusFilter || undefined,
      page,
      limit: 20,
    }),
  })

  const approvals = data?.items ?? []
  const pagination = data?.pagination ?? { page: 1, pages: 1, total: 0 }

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      approvalsApi.reject(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      setRejectDialog(null)
      setRejectComment('')
    },
  })

  const handleApprove = (id: string) => {
    approveMutation.mutate(id)
  }

  const handleReject = () => {
    if (!rejectDialog || !rejectComment.trim()) return
    rejectMutation.mutate({ id: rejectDialog.id, comment: rejectComment })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileCheck className="w-7 h-7 text-blue-500" />
          콘텐츠 승인
        </h1>
        <p className="text-gray-500 mt-1">업로드된 콘텐츠의 승인/거부를 관리합니다</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { value: 'PENDING', label: '대기 중' },
          { value: 'APPROVED', label: '승인됨' },
          { value: 'REJECTED', label: '거부됨' },
          { value: '', label: '전체' },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1) }}
            className={`px-4 py-2 text-sm rounded-md transition ${
              statusFilter === tab.value ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.value === 'PENDING' && pagination.total > 0 && statusFilter === 'PENDING' && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-yellow-500 text-white rounded-full">{pagination.total}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">로딩 중...</div>
      ) : approvals.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileCheck className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg">
            {statusFilter === 'PENDING' ? '승인 대기 중인 콘텐츠가 없습니다' : '항목이 없습니다'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border divide-y">
          {approvals.map(item => {
            const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING
            const ContentIcon = TYPE_ICONS[item.content?.type || ''] || FileText

            return (
              <div key={item.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                {/* Content Preview */}
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.content?.thumbnail ? (
                    <img src={item.content.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ContentIcon className="w-8 h-8 text-gray-300" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">{item.content?.name || '삭제된 콘텐츠'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1 flex items-center gap-3">
                    <span>요청: {item.requester?.username || '-'}</span>
                    <span>{new Date(item.requestedAt).toLocaleString('ko-KR')}</span>
                    {item.reviewer && <span>검토: {item.reviewer.username}</span>}
                  </div>
                  {item.comment && (
                    <div className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {item.comment}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {item.status === 'PENDING' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      <CheckCircle className="w-4 h-4" /> 승인
                    </button>
                    <button
                      onClick={() => setRejectDialog({ id: item.id })}
                      className="flex items-center gap-1 px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm"
                    >
                      <XCircle className="w-4 h-4" /> 거부
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.pages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-8 h-8 rounded-lg text-sm ${
                pagination.page === i + 1 ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      {rejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold text-red-600">콘텐츠 거부</h3>
              <button onClick={() => setRejectDialog(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">거부 사유 *</label>
                <textarea
                  value={rejectComment}
                  onChange={e => setRejectComment(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 h-24 resize-none"
                  placeholder="콘텐츠 거부 사유를 입력해주세요"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t">
              <button onClick={() => setRejectDialog(null)} className="px-4 py-2 text-gray-600">취소</button>
              <button
                onClick={handleReject}
                disabled={!rejectComment.trim()}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                거부
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
