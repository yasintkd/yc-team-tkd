import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import LoadingSkeleton from './components/LoadingSkeleton'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Athletes = lazy(() => import('./pages/Athletes'))
const BeltExams = lazy(() => import('./pages/BeltExams'))
const Competitions = lazy(() => import('./pages/Competitions'))
const Attendance = lazy(() => import('./pages/Attendance'))
const ToolsPage = lazy(() => import('./pages/ToolsPage'))
const EventsPage = lazy(() => import('./pages/EventsPage'))
const Reports = lazy(() => import('./pages/Reports'))
const CalendarPage = lazy(() => import('./pages/Calendar'))
const AttendanceHub = lazy(() => import('./pages/AttendanceHub'))
const Login = lazy(() => import('./pages/Login'))
const Groups = lazy(() => import('./pages/Groups'))
const AthleteDetail = lazy(() => import('./pages/AthleteDetail'))
const UnlicensedAthletes = lazy(() => import('./pages/UnlicensedAthletes'))
const ProtectedRoute = lazy(() => import('./auth/ProtectedRoute'))

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingSkeleton variant="card" count={3} />}>
      {children}
    </Suspense>
  )
}

function App() {
  return (
    <div className="h-full">
      <Layout>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/giris" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <SuspenseWrapper><Dashboard /></SuspenseWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sporcular"
              element={
                <ProtectedRoute>
                  <SuspenseWrapper><Athletes /></SuspenseWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/etkinlikler"
              element={
                <ProtectedRoute>
                  <SuspenseWrapper><EventsPage /></SuspenseWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/kusak-sinavi"
              element={
                <ProtectedRoute>
                  <SuspenseWrapper><BeltExams /></SuspenseWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/yarisma"
              element={
                <ProtectedRoute>
                  <SuspenseWrapper><Competitions /></SuspenseWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/yoklama"
              element={
                <ProtectedRoute>
                  <SuspenseWrapper><AttendanceHub /></SuspenseWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/yoklama-detay"
              element={
                <ProtectedRoute>
                  <SuspenseWrapper><Attendance /></SuspenseWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/gruplar"
              element={
                <ProtectedRoute>
                  <SuspenseWrapper><Groups /></SuspenseWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/malzeme"
              element={
                <ProtectedRoute>
                  <SuspenseWrapper><ToolsPage /></SuspenseWrapper>
                </ProtectedRoute>
              }
            />
            <Route path="/sporcular/:id" element={<ProtectedRoute><SuspenseWrapper><AthleteDetail /></SuspenseWrapper></ProtectedRoute>} />
            <Route
              path="/vizesiz-sporcular"
              element={
                <ProtectedRoute>
                  <SuspenseWrapper><UnlicensedAthletes /></SuspenseWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/raporlar"
              element={
                <ProtectedRoute>
                  <SuspenseWrapper><Reports /></SuspenseWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/takvim"
              element={
                <ProtectedRoute>
                  <SuspenseWrapper><CalendarPage /></SuspenseWrapper>
                </ProtectedRoute>
              }
            />
            <Route path="/odemeler" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </div>
  )
}

export default App
