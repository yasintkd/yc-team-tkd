import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Athletes from './pages/Athletes'
import Payments from './pages/Payments'
import Attendance from './pages/Attendance'

function App() {
  return (
    <div className="h-full">
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/sporcular" element={<Athletes />} />
          <Route path="/odemeler" element={<Payments />} />
          <Route path="/yoklama" element={<Attendance />} />
        </Routes>
      </Layout>
    </div>
  )
}

export default App
