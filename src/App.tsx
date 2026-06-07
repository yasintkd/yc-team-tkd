import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Athletes from './pages/Athletes'
import Groups from './pages/Groups'
import BeltExams from './pages/BeltExams'
import Attendance from './pages/Attendance'
import Materials from './pages/Materials'
import Login from './pages/Login'
import ProtectedRoute from './auth/ProtectedRoute'

function App() {
  return (
    <div className="h-full">
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/giris" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sporcular"
            element={
              <ProtectedRoute>
                <Athletes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gruplar"
            element={
              <ProtectedRoute>
                <Groups />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kusak-sinavi"
            element={
              <ProtectedRoute>
                <BeltExams />
              </ProtectedRoute>
            }
          />
          <Route
            path="/yoklama"
            element={
              <ProtectedRoute>
                <Attendance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/malzeme"
            element={
              <ProtectedRoute>
                <Materials />
              </ProtectedRoute>
            }
          />
          <Route path="/odemeler" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </div>
  )
}

export default App
