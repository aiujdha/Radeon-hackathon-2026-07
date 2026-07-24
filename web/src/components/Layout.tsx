import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'

/** App shell: top navigation bar with brand, current user, and sign-out. */
export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  return (
    <div>
      <nav className="topnav">
        <span className="brand">Radeon Unified Workbench</span>
        <span className="user">
          <span>{user?.display_name ?? user?.username ?? 'Guest'}</span>
          <button type="button" className="retry" onClick={logout}>
            Sign out
          </button>
        </span>
      </nav>
      <main className="main">{children}</main>
    </div>
  )
}
