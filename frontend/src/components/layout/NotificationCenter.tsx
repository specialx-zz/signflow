import { useState, useEffect, useRef } from 'react'
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react'
import { notificationApi, type Notification } from '@/api/notifications'

const TYPE_ICONS: Record<string, { emoji: string; color: string }> = {
  DEVICE_STATUS: { emoji: '\u{1F4E1}', color: 'text-blue-500' },
  APPROVAL: { emoji: '\u2705', color: 'text-green-500' },
  EMERGENCY: { emoji: '\u{1F6A8}', color: 'text-red-500' },
  QUOTA: { emoji: '\u26A0\uFE0F', color: 'text-yellow-500' },
  SUBSCRIPTION: { emoji: '\u{1F4B3}', color: 'text-purple-500' },
  SYSTEM: { emoji: '\u{1F527}', color: 'text-gray-500' },
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch unread count periodically
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000) // every 30s
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchUnreadCount = async () => {
    try {
      const { data } = await notificationApi.getUnreadCount()
      setUnreadCount(data.count)
    } catch { /* ignore */ }
  }

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const { data } = await notificationApi.getAll({ limit: 20 })
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch { /* ignore */ }
    setLoading(false)
  }

  const handleToggle = () => {
    if (!isOpen) fetchNotifications()
    setIsOpen(!isOpen)
  }

  const handleMarkAsRead = async (id: string) => {
    await notificationApi.markAsRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const handleMarkAllAsRead = async () => {
    await notificationApi.markAllAsRead()
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }

  const handleDelete = async (id: string) => {
    const found = notifications.find(n => n.id === id)
    await notificationApi.delete(id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (found && !found.isRead) setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return '\uBC29\uAE08 \uC804'
    if (minutes < 60) return `${minutes}\uBD84 \uC804`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}\uC2DC\uAC04 \uC804`
    const days = Math.floor(hours / 24)
    return `${days}\uC77C \uC804`
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="\uC54C\uB9BC"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">{'\uC54C\uB9BC'}</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  {'\uBAA8\uB450 \uC77D\uC74C'}
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">{'\uB85C\uB529\uC911...'}</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                {'\uC54C\uB9BC\uC774 \uC5C6\uC2B5\uB2C8\uB2E4'}
              </div>
            ) : (
              notifications.map(n => {
                const typeInfo = TYPE_ICONS[n.type] || TYPE_ICONS.SYSTEM
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
                      !n.isRead ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <span className="text-lg mt-0.5">{typeInfo.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${!n.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{n.message}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatTime(n.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!n.isRead && (
                        <button
                          onClick={() => handleMarkAsRead(n.id)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                          title={'\uC77D\uC74C \uCC98\uB9AC'}
                        >
                          <Check className="w-3 h-3 text-blue-500" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(n.id)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        title={'\uC0AD\uC81C'}
                      >
                        <Trash2 className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
