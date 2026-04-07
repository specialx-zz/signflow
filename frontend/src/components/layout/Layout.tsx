import { useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useSocket } from '@/hooks/useSocket'

export default function Layout() {
  // Initialize the global socket singleton on layout mount
  useSocket()

  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSidebarClose = useCallback(() => setSidebarOpen(false), [])
  const handleSidebarToggle = useCallback(() => setSidebarOpen(prev => !prev), [])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 dark:text-gray-100">
      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={handleSidebarClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-56 flex-shrink-0 h-full overflow-hidden
          transform transition-transform duration-300 ease-in-out
          lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar onClose={handleSidebarClose} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuToggle={handleSidebarToggle} />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
