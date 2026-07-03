import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider'
import { ToastProvider } from './components/Toast'

// Mobil zoom'u tamamen engelle (çift tıklama, pinch, gesture)
if (typeof window !== 'undefined') {
  // --- iOS Safari gesture events (pinch zoom) ---
  document.addEventListener('gesturestart', (e) => {
    e.preventDefault()
  }, { passive: false })
  document.addEventListener('gesturechange', (e) => {
    e.preventDefault()
  }, { passive: false })
  document.addEventListener('gestureend', (e) => {
    e.preventDefault()
  }, { passive: false })

  // --- Çift tıklama ile zoom'u engelle ---
  let lastTouchEnd = 0
  document.addEventListener('touchend', (e) => {
    const now = Date.now()
    if (now - lastTouchEnd <= 300) {
      e.preventDefault()
    }
    lastTouchEnd = now
  }, { passive: false })

  // --- İki parmak (pinch) zoom'u engelle (touchstart + touchmove) ---
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault()
    }
  }, { passive: false })
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault()
    }
  }, { passive: false })

  // --- Ctrl/Cmd +/- zoom'u engelle (masaüstü) ---
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === '+' || e.key === '-' || e.key === '=') {
        e.preventDefault()
      }
    }
  }, { passive: false })

  // --- Fare tekerleği + Ctrl zoom'unu engelle ---
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
    }
  }, { passive: false })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)