import { useState, useEffect } from 'react'
import { Link2, Plus, Trash2, Send, Eye, ToggleLeft, ToggleRight, CheckCircle, XCircle, Clock } from 'lucide-react'
import { webhookApi, WEBHOOK_EVENTS, type Webhook, type WebhookLog } from '@/api/webhooks'
import Modal from '@/components/ui/Modal'

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showLogs, setShowLogs] = useState<string | null>(null)
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [creating, setCreating] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])

  useEffect(() => { fetchWebhooks() }, [])

  const fetchWebhooks = async () => {
    setLoading(true)
    try {
      const { data } = await webhookApi.getAll()
      setWebhooks(data.webhooks || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!name || !url || selectedEvents.length === 0) {
      alert('이름, URL, 이벤트를 모두 입력해주세요')
      return
    }
    setCreating(true)
    try {
      await webhookApi.create({ name, url, events: selectedEvents })
      setShowCreate(false)
      setName(''); setUrl(''); setSelectedEvents([])
      fetchWebhooks()
    } catch (e: any) {
      alert(e.response?.data?.error || '생성 실패')
    }
    setCreating(false)
  }

  const handleToggle = async (webhook: Webhook) => {
    try {
      await webhookApi.update(webhook.id, { isActive: !webhook.isActive })
      fetchWebhooks()
    } catch (e) { console.error(e) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 웹훅을 삭제할까요?')) return
    try {
      await webhookApi.delete(id)
      fetchWebhooks()
    } catch (e) { console.error(e) }
  }

  const handleTest = async (id: string) => {
    try {
      const { data } = await webhookApi.test(id)
      alert(data.success ? '테스트 성공!' : `테스트 실패 (${data.statusCode})`)
    } catch (e: any) {
      alert('테스트 실패: ' + (e.response?.data?.error || e.message))
    }
  }

  const handleViewLogs = async (id: string) => {
    setShowLogs(id)
    try {
      const { data } = await webhookApi.getLogs(id)
      setLogs(data.logs || [])
    } catch (e) { console.error(e) }
  }

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Link2 className="w-7 h-7 text-orange-500" />
            웹훅 관리
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">외부 시스템과 이벤트 연동</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700">
          <Plus className="w-4 h-4" /> 웹훅 추가
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">로딩중...</div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Link2 className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">등록된 웹훅이 없습니다</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">웹훅을 추가하여 외부 시스템과 연동하세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(w => (
            <div key={w.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{w.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${w.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                      {w.isActive ? '활성' : '비활성'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">{w.url}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {w.events.split(',').map(evt => (
                      <span key={evt} className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded">
                        {WEBHOOK_EVENTS.find(e => e.value === evt.trim())?.label || evt.trim()}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleToggle(w)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title={w.isActive ? '비활성화' : '활성화'}>
                    {w.isActive ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                  </button>
                  <button onClick={() => handleTest(w.id)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="테스트">
                    <Send className="w-4 h-4 text-blue-500" />
                  </button>
                  <button onClick={() => handleViewLogs(w.id)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="로그">
                    <Eye className="w-4 h-4 text-gray-500" />
                  </button>
                  <button onClick={() => handleDelete(w.id)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="삭제">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal isOpen={showCreate} title="웹훅 추가" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">이름 *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="예: Slack 알림" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">URL *</label>
              <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://hooks.slack.com/..." className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">이벤트 *</label>
              <div className="grid grid-cols-2 gap-2">
                {WEBHOOK_EVENTS.map(evt => (
                  <label key={evt.value} className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input type="checkbox" checked={selectedEvents.includes(evt.value)} onChange={() => toggleEvent(evt.value)} className="rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{evt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">취소</button>
              <button onClick={handleCreate} disabled={creating} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
                {creating ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Logs Modal */}
      {showLogs && (
        <Modal isOpen={!!showLogs} title="웹훅 발송 이력" onClose={() => setShowLogs(null)}>
          <div className="max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">발송 이력이 없습니다</p>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    {log.success ? (
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{log.event}</span>
                        {log.statusCode && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${log.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {log.statusCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(log.createdAt).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
