/**
 * Mobil/desktop zoom'u tamamen engeller.
 *
 * Kullanım:
 *   import { preventZoom } from './preventZoom'
 *   preventZoom() // uygulama başlangıcında bir kere çağır
 *
 * Bağımlılık: yok
 *
 * Neleri engeller:
 * - iOS Safari gesture (pinch zoom)
 * - Çift tıklama zoom'u
 * - İki parmak pinch zoom
 * - Ctrl/Cmd +/- tuş zoom'u
 * - Ctrl + fare tekerleği zoom'u
 * - input/textarea/select focus'unda iOS zoom'u (font-size >= 16px)
 * - user-select (seçme) engelleme (opsiyonel, isteğe bağlı kullan)
 */

export function preventZoom(options?: { disableUserSelect?: boolean }): void {
  if (typeof window === 'undefined') return

  // 1. iOS Safari gesture events
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false })
  document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false })
  document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false })

  // 2. Çift tıklama zoom'u
  let lastTouchEnd = 0
  document.addEventListener('touchend', (e) => {
    const now = Date.now()
    if (now - lastTouchEnd <= 300) e.preventDefault()
    lastTouchEnd = now
  }, { passive: false })

  // 3. İki parmak (pinch) zoom
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) e.preventDefault()
  }, { passive: false })
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault()
  }, { passive: false })

  // 4. Ctrl/Cmd +/- tuş zoom'u
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=')) {
      e.preventDefault()
    }
  }, { passive: false })

  // 5. Ctrl + fare tekerleği zoom'u
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault()
  }, { passive: false })

  // 6. user-select engelle (opsiyonel)
  if (options?.disableUserSelect) {
    document.documentElement.style.userSelect = 'none'
    document.documentElement.style.webkitUserSelect = 'none'
  }
}