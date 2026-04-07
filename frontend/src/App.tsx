import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import Layout from '@/components/layout/Layout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ContentPage from '@/pages/ContentPage'
import PlaylistsPage from '@/pages/PlaylistsPage'
import PlaylistEditorPage from '@/pages/PlaylistEditorPage'
import SchedulesPage from '@/pages/SchedulesPage'
import DevicesPage from '@/pages/DevicesPage'
import DeviceDetailPage from '@/pages/DeviceDetailPage'
import StatsPage from '@/pages/StatsPage'
import UsersPage from '@/pages/UsersPage'
import SettingsPage from '@/pages/SettingsPage'
import MonitoringPage from '@/pages/MonitoringPage'
import LayoutsPage from '@/pages/LayoutsPage'
import LayoutEditorPage from '@/pages/LayoutEditorPage'
import TenantsPage from '@/pages/TenantsPage'
import StoresPage from '@/pages/StoresPage'
import BillingPage from '@/pages/BillingPage'
import SubscriptionPage from '@/pages/SubscriptionPage'
import EmergencyPage from '@/pages/EmergencyPage'
import SharedContentPage from '@/pages/SharedContentPage'
import ApprovalsPage from '@/pages/ApprovalsPage'
import ReportsPage from '@/pages/ReportsPage'
import TemplatesPage from '@/pages/TemplatesPage'
import WebhooksPage from '@/pages/WebhooksPage'
import CanvasListPage from '@/pages/CanvasListPage'
import CanvasEditorPage from '@/pages/CanvasEditorPage'
import ChannelsPage from '@/pages/ChannelsPage'
import TagPlaybackPage from '@/pages/TagPlaybackPage'
import ScreenWallPage from '@/pages/ScreenWallPage'

function ProtectedRoute({ children, minRole }: { children: React.ReactNode; minRole?: number }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  const roleLevel: Record<string, number> = {
    'SUPER_ADMIN': 50,
    'TENANT_ADMIN': 40,
    'STORE_MANAGER': 30,
    'USER': 20,
    'VIEWER': 10,
  }
  if (minRole && user && (roleLevel[user.role] || 0) < minRole) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <ErrorBoundary>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Full-page editor routes (no sidebar layout) */}
      <Route
        path="/layouts/:id"
        element={
          <ProtectedRoute>
            <LayoutEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/canvas/editor"
        element={
          <ProtectedRoute>
            <CanvasEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/canvas/editor/:id"
        element={
          <ProtectedRoute>
            <CanvasEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="admin/tenants" element={<ProtectedRoute minRole={50}><TenantsPage /></ProtectedRoute>} />
        <Route path="admin/billing" element={<BillingPage />} />
        <Route path="stores" element={<ProtectedRoute minRole={40}><StoresPage /></ProtectedRoute>} />
        <Route path="subscription" element={<ProtectedRoute minRole={40}><SubscriptionPage /></ProtectedRoute>} />
        <Route path="content" element={<ContentPage />} />
        <Route path="canvas" element={<CanvasListPage />} />
        <Route path="channels" element={<ChannelsPage />} />
        <Route path="playlists" element={<PlaylistsPage />} />
        <Route path="playlists/:id" element={<PlaylistEditorPage />} />
        <Route path="layouts" element={<LayoutsPage />} />
        <Route path="schedules" element={<SchedulesPage />} />
        <Route path="tag-playback" element={<TagPlaybackPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="screen-wall" element={<ProtectedRoute minRole={30}><ScreenWallPage /></ProtectedRoute>} />
        <Route path="devices/:id" element={<DeviceDetailPage />} />
        <Route path="monitoring" element={<MonitoringPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="users" element={<ProtectedRoute minRole={40}><UsersPage /></ProtectedRoute>} />
        <Route path="emergency" element={<ProtectedRoute minRole={30}><EmergencyPage /></ProtectedRoute>} />
        <Route path="shared-content" element={<SharedContentPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="approvals" element={<ProtectedRoute minRole={30}><ApprovalsPage /></ProtectedRoute>} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="webhooks" element={<ProtectedRoute minRole={40}><WebhooksPage /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute minRole={40}><SettingsPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ErrorBoundary>
  )
}

export default App
