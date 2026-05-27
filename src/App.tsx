import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Athletes from './pages/Athletes'
import Payments from './pages/Payments'
import Attendance from './pages/Attendance'
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
            path="/odemeler"
            element={
              <ProtectedRoute>
                <Payments />
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
        </Routes>
      </Layout>
    </div>
  )
}

export default App
