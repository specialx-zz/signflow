import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit2, User, Search, Shield, Eye, UserCheck, KeyRound } from 'lucide-react'
import { userApi } from '@/api/users'
import { authApi } from '@/api/auth'
import { User as UserType } from '@/types'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import StatusBadge from '@/components/ui/StatusBadge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import Pagination from '@/components/ui/Pagination'
import { useAuthStore } from '@/store/authStore'
import { useDebounce } from '@/hooks/useDebounce'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const ITEMS_PER_PAGE = 20

const roleIcons: Record<string, React.ElementType> = {
  SUPER_ADMIN: Shield,
  TENANT_ADMIN: Shield,
  STORE_MANAGER: UserCheck,
  ADMIN: Shield,
  USER: UserCheck,
  VIEWER: Eye
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuthStore()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [roleFilter, setRoleFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<UserType | null>(null)
  const [editTarget, setEditTarget] = useState<UserType | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'USER' })
  const [passwordTarget, setPasswordTarget] = useState<UserType | null>(null)
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
  const [passwordChanging, setPasswordChanging] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['users', { search: debouncedSearch, role: roleFilter }],
    queryFn: () => userApi.getAll({ search: debouncedSearch, role: roleFilter || undefined })
  })

  const createMutation = useMutation({
    mutationFn: userApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setCreateModalOpen(false)
      setForm({ username: '', email: '', password: '', role: 'USER' })
      toast.success('사용자가 생성되었습니다')
    },
    onError: () => toast.error('생성에 실패했습니다')
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      userApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditTarget(null)
      toast.success('사용자 정보가 수정되었습니다')
    },
    onError: () => toast.error('수정에 실패했습니다')
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeleteTarget(null)
      toast.success('사용자가 삭제되었습니다')
    },
    onError: () => toast.error('사용자 삭제에 실패했습니다')
  })

  const toggleActive = (user: UserType) => {
    updateMutation.mutate({ id: user.id, data: { isActive: !user.isActive } })
  }

  const users: UserType[] = data?.items || []
  const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE)
  const paginatedUsers = useMemo(
    () => users.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [users, page]
  )

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">사용자 관리</h1>
          <p className="text-gray-500 text-sm mt-1">시스템 사용자 및 권한을 관리하세요</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateModalOpen(true)}>
          <Plus className="w-4 h-4" />
          사용자 추가
        </button>
      </div>

      {/* Toolbar */}
      <div className="card p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="사용자 검색..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="input pl-9"
            />
          </div>
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }} className="select w-36">
            <option value="">전체 역할</option>
            <option value="SUPER_ADMIN">최고관리자</option>
            <option value="TENANT_ADMIN">업체관리자</option>
            <option value="STORE_MANAGER">매장관리자</option>
            <option value="USER">사용자</option>
            <option value="VIEWER">뷰어</option>
          </select>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="card">
          <EmptyState icon={User} title="사용자가 없습니다" description="새 사용자를 추가하세요" />
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>사용자</th>
                <th>소속 업체</th>
                <th>역할</th>
                <th>상태</th>
                <th>마지막 로그인</th>
                <th>생성일</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map(user => {
                const RoleIcon = roleIcons[user.role] || User
                const isCurrentUser = user.id === currentUser?.id
                return (
                  <tr key={user.id} className={isCurrentUser ? 'bg-blue-50/30' : ''}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                          <RoleIcon className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">
                            {user.username}
                            {isCurrentUser && <span className="ml-2 text-xs text-blue-500">(나)</span>}
                          </div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm text-gray-600">{user.tenantName || '-'}</td>
                    <td><StatusBadge status={user.role} /></td>
                    <td>
                      <span className={`badge ${user.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {user.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="text-gray-500 text-sm">
                      {user.lastLogin ? format(new Date(user.lastLogin), 'yyyy-MM-dd HH:mm') : '없음'}
                    </td>
                    <td className="text-gray-500 text-sm">
                      {format(new Date(user.createdAt), 'yyyy-MM-dd')}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="btn-ghost btn-sm p-1.5"
                          onClick={() => setEditTarget(user)}
                          title="편집"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                          onClick={() => { setPasswordTarget(user); setPasswordForm({ newPassword: '', confirmPassword: '' }) }}
                          title="비밀번호 변경"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          className={`p-1.5 rounded-lg text-xs font-medium transition-colors
                            ${user.isActive ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                          onClick={() => toggleActive(user)}
                          disabled={isCurrentUser}
                          title={user.isActive ? '비활성화' : '활성화'}
                        >
                          {user.isActive ? '비활성화' : '활성화'}
                        </button>
                        {!isCurrentUser && (
                          <button
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            onClick={() => setDeleteTarget(user)}
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Create Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="사용자 추가"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCreateModalOpen(false)}>취소</button>
            <button
              className="btn-primary"
              onClick={() => createMutation.mutate(form)}
              disabled={!form.username || !form.email || !form.password || createMutation.isPending}
            >
              {createMutation.isPending ? '생성 중...' : '생성'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">사용자명 *</label>
            <input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="input" placeholder="사용자명" />
          </div>
          <div>
            <label className="label">이메일 *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input" placeholder="이메일" />
          </div>
          <div>
            <label className="label">비밀번호 *</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="input" placeholder="비밀번호" />
          </div>
          <div>
            <label className="label">역할</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="select">
              {currentUser?.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">최고관리자</option>}
              <option value="TENANT_ADMIN">업체관리자</option>
              <option value="STORE_MANAGER">매장관리자</option>
              <option value="USER">사용자</option>
              <option value="VIEWER">뷰어</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      {editTarget && (
        <Modal
          isOpen={!!editTarget}
          onClose={() => { setEditTarget(null); setPasswordForm({ newPassword: '', confirmPassword: '' }) }}
          title="사용자 편집"
          footer={
            <>
              <button className="btn-secondary" onClick={() => { setEditTarget(null); setPasswordForm({ newPassword: '', confirmPassword: '' }) }}>취소</button>
              <button
                className="btn-primary"
                onClick={() => updateMutation.mutate({ id: editTarget.id, data: { role: editTarget.role } })}
                disabled={updateMutation.isPending}
              >
                저장
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="label">사용자명</label>
              <input type="text" value={editTarget.username} readOnly className="input bg-gray-50" />
            </div>
            <div>
              <label className="label">이메일</label>
              <input type="email" value={editTarget.email} readOnly className="input bg-gray-50" />
            </div>
            <div>
              <label className="label">역할</label>
              <select
                value={editTarget.role}
                onChange={e => setEditTarget(t => t ? { ...t, role: e.target.value as UserType['role'] } : null)}
                className="select"
              >
                {currentUser?.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">최고관리자</option>}
                <option value="TENANT_ADMIN">업체관리자</option>
                <option value="STORE_MANAGER">매장관리자</option>
                <option value="USER">사용자</option>
                <option value="VIEWER">뷰어</option>
              </select>
            </div>

            {/* Password Change Section */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">비밀번호 변경</span>
              </div>
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="새 비밀번호 (8자 이상, 대소문자+숫자)"
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                  className="input"
                />
                <input
                  type="password"
                  placeholder="비밀번호 확인"
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  className="input"
                />
                <button
                  type="button"
                  className="btn-secondary w-full"
                  disabled={passwordChanging || !passwordForm.newPassword || !passwordForm.confirmPassword}
                  onClick={async () => {
                    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                      toast.error('비밀번호가 일치하지 않습니다')
                      return
                    }
                    if (passwordForm.newPassword.length < 8) {
                      toast.error('비밀번호는 8자 이상이어야 합니다')
                      return
                    }
                    setPasswordChanging(true)
                    try {
                      await userApi.update(editTarget.id, { password: passwordForm.newPassword })
                      toast.success('비밀번호가 변경되었습니다')
                      setPasswordForm({ newPassword: '', confirmPassword: '' })
                    } catch {
                      toast.error('비밀번호 변경에 실패했습니다')
                    } finally {
                      setPasswordChanging(false)
                    }
                  }}
                >
                  {passwordChanging ? '변경 중...' : '비밀번호 변경'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Password Change Modal */}
      {passwordTarget && (
        <Modal
          isOpen={!!passwordTarget}
          onClose={() => { setPasswordTarget(null); setPasswordForm({ newPassword: '', confirmPassword: '' }) }}
          title="비밀번호 변경"
          footer={
            <>
              <button className="btn-secondary" onClick={() => { setPasswordTarget(null); setPasswordForm({ newPassword: '', confirmPassword: '' }) }}>취소</button>
              <button
                className="btn-primary"
                disabled={passwordChanging || !passwordForm.newPassword || !passwordForm.confirmPassword}
                onClick={async () => {
                  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                    toast.error('비밀번호가 일치하지 않습니다')
                    return
                  }
                  if (passwordForm.newPassword.length < 8) {
                    toast.error('비밀번호는 8자 이상이어야 합니다')
                    return
                  }
                  setPasswordChanging(true)
                  try {
                    await userApi.update(passwordTarget.id, { password: passwordForm.newPassword })
                    toast.success('비밀번호가 변경되었습니다')
                    setPasswordTarget(null)
                    setPasswordForm({ newPassword: '', confirmPassword: '' })
                  } catch {
                    toast.error('비밀번호 변경에 실패했습니다')
                  } finally {
                    setPasswordChanging(false)
                  }
                }}
              >
                {passwordChanging ? '변경 중...' : '비밀번호 변경'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-gray-800">{passwordTarget.username}</div>
                <div className="text-xs text-gray-500">{passwordTarget.email}</div>
              </div>
            </div>
            <div>
              <label className="label">새 비밀번호 *</label>
              <input
                type="password"
                placeholder="새 비밀번호 (8자 이상)"
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label">비밀번호 확인 *</label>
              <input
                type="password"
                placeholder="비밀번호를 다시 입력하세요"
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                className="input"
              />
            </div>
            {passwordForm.newPassword && passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
              <p className="text-xs text-red-500">비밀번호가 일치하지 않습니다</p>
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="사용자 삭제"
        message={`"${deleteTarget?.username}" 사용자를 삭제하시겠습니까?`}
        confirmLabel="삭제"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
