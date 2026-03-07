import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <NavLink to="/" className="text-2xl font-bold text-brand-500">
            mmmh
          </NavLink>
          <div className="flex items-center gap-3">
            <img
              src={user?.user_metadata?.avatar_url}
              alt=""
              className="w-8 h-8 rounded-full"
              referrerPolicy="no-referrer"
            />
            <button
              onClick={signOut}
              className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4">
        <Outlet />
      </main>

      {/* Bottom Nav */}
      <nav className="sticky bottom-0 bg-slate-900/80 backdrop-blur-lg border-t border-slate-800">
        <div className="max-w-lg mx-auto flex">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 text-sm transition-colors ${
                isActive ? 'text-brand-500' : 'text-slate-500'
              }`
            }
          >
            <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Feed
          </NavLink>
          <NavLink
            to="/new"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 text-sm transition-colors ${
                isActive ? 'text-brand-500' : 'text-slate-500'
              }`
            }
          >
            <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Post
          </NavLink>
          <NavLink
            to="/messages"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 text-sm transition-colors ${
                isActive ? 'text-brand-500' : 'text-slate-500'
              }`
            }
          >
            <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Chat
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
