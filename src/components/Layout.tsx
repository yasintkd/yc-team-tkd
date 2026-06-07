import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileNav from './MobileNav'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const isLogin = location.pathname === '/giris'

  return (
    <div className="flex h-full min-h-0">
      {!isLogin && <Sidebar />}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!isLogin && <Topbar />}
        <main
          className={`flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-br from-app-bg via-app-bg-soft to-sky-100 ${
            isLogin
              ? 'p-4'
              : 'safe-bottom px-3 py-4 md:p-6 md:pb-6'
          }`}
        >
          <div
            key={isLogin ? 'login' : location.pathname}
            className={`mx-auto space-y-4 md:space-y-6 page-enter-active ${
              isLogin ? 'max-w-md' : 'max-w-6xl'
            }`}
          >
            {children}
          </div>
        </main>
        {!isLogin && <MobileNav />}
      </div>
    </div>
  )
}
