import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import './App.css'
import './site.css'
import { WeddingProvider } from './context/WeddingContext.jsx'
import { useWedding } from './context/useWedding.jsx'
import InvitationPage from './pages/InvitationPage.jsx'
const FeatureLayout = lazy(() => import('./pages/FeatureLayout.jsx'))
const GiftsPage = lazy(() => import('./pages/GiftsPage.jsx'))
const GuestRsvpPage = lazy(() => import('./pages/GuestRsvpPage.jsx'))
const MessagesPage = lazy(() => import('./pages/MessagesPage.jsx'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'))
const AdminDeliveriesPage = lazy(() => import('./pages/admin/AdminDeliveriesPage.jsx'))
const AdminGiftsPage = lazy(() => import('./pages/admin/AdminGiftsPage.jsx'))
const AdminGuestsPage = lazy(() => import('./pages/admin/AdminGuestsPage.jsx'))
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage.jsx'))
const AdminMessagesPage = lazy(() => import('./pages/admin/AdminMessagesPage.jsx'))
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage.jsx'))
const AdminRsvpPage = lazy(() => import('./pages/admin/AdminRsvpPage.jsx'))

function RouteFallback() {
  return (
    <div className="route-fallback" aria-live="polite">
      <div className="route-fallback__card">
        <span className="feature-kicker">Cargando</span>
        <strong>Preparando la sección…</strong>
      </div>
    </div>
  )
}

function AdminEntryRedirect() {
  const { isAuthenticated } = useWedding()
  return <Navigate to={isAuthenticated ? '/admin/reportes' : '/admin/login'} replace />
}

function ProtectedAdmin() {
  const { isAuthenticated } = useWedding()

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />
  }

  return <Outlet />
}

function AppRoutes() {
  return (
    <HashRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<InvitationPage />} />

          <Route element={<FeatureLayout />}>
            <Route path="/confirmar/:token" element={<GuestRsvpPage />} />
            <Route path="/regalos" element={<GiftsPage />} />
            <Route path="/mensajes" element={<MessagesPage />} />
          </Route>

          <Route path="/admin" element={<AdminEntryRedirect />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route element={<ProtectedAdmin />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="reportes" replace />} />
              <Route path="invitados" element={<AdminGuestsPage />} />
              <Route path="rsvp" element={<AdminRsvpPage />} />
              <Route path="regalos" element={<AdminGiftsPage />} />
              <Route path="mensajes" element={<AdminMessagesPage />} />
              <Route path="envios" element={<AdminDeliveriesPage />} />
              <Route path="reportes" element={<AdminReportsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}

export default function App() {
  return (
    <WeddingProvider>
      <AppRoutes />
    </WeddingProvider>
  )
}
