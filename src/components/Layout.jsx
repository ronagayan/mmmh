import { useState, useRef, useCallback } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import FoodGame from './FoodGame'

export default function Layout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const [showGame, setShowGame] = useState(false)

  // ── Secret 7-click easter egg ─────────────────────────────
  const clickCountRef = useRef(0)
  const clickTimerRef = useRef(null)
  const [logoFlash, setLogoFlash] = useState(false)
  const [clickProgress, setClickProgress] = useState(0) // 0–7

  const handleLogoClick = useCallback((e) => {
    e.preventDefault() // prevent nav on repeated clicks

    clickCountRef.current += 1
    const count = clickCountRef.current
    setClickProgress(Math.min(count, 7))

    // Flash logo on each click
    setLogoFlash(true)
    setTimeout(() => setLogoFlash(false), 120)

    if (count >= 7) {
      // Trigger game!
      clickCountRef.current = 0
      setClickProgress(0)
      clearTimeout(clickTimerRef.current)
      setShowGame(true)
      return
    }

    // Reset counter if no click within 1.2s
    clearTimeout(clickTimerRef.current)
    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0
      setClickProgress(0)
    }, 1200)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#080d18]/85 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">

          {/* Logo — clickable easter egg */}
          <div className="relative">
            <button
              type="button"
              onClick={handleLogoClick}
              className="text-2xl font-bold transition-all duration-100 hover:opacity-80 select-none"
              style={{
                color: logoFlash ? '#fff' : '#f97316',
                textShadow: logoFlash
                  ? '0 0 30px rgba(255,255,255,0.8), 0 0 60px rgba(249,115,22,0.6)'
                  : '0 0 20px rgba(249,115,22,0.35)',
                transform: logoFlash ? 'scale(1.12)' : 'scale(1)',
                transition: 'color 0.1s, text-shadow 0.1s, transform 0.1s',
              }}
            >
              mmmh
            </button>

            {/* Progress dots — only show after first click */}
            {clickProgress > 0 && (
              <div className="absolute -bottom-2.5 left-0 right-0 flex gap-0.5 justify-center">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 h-1 rounded-full transition-all duration-100"
                    style={{
                      background: i < clickProgress ? '#f97316' : 'rgba(255,255,255,0.15)',
                      transform: i < clickProgress ? 'scale(1.2)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {user?.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt=""
                className="w-8 h-8 rounded-full ring-2 ring-brand-500/30"
                referrerPolicy="no-referrer"
              />
            )}
            <button
              onClick={signOut}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main
        key={location.pathname}
        className="flex-1 max-w-lg mx-auto w-full px-4 py-4 page-enter"
      >
        <Outlet />
      </main>

      {/* Bottom Nav */}
      <nav className="sticky bottom-0 bg-[#080d18]/90 backdrop-blur-xl border-t border-white/5">
        <div className="max-w-lg mx-auto flex">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 transition-all duration-200 relative ${
                isActive ? 'text-brand-500' : 'text-slate-600 hover:text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <svg
                  className={`w-6 h-6 mb-0.5 transition-all duration-200 ${isActive ? 'nav-icon-active scale-110' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={isActive ? 2.5 : 2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="text-xs font-medium">Feed</span>
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-brand-500 animate-dot-expand" />
                )}
              </>
            )}
          </NavLink>

          <NavLink
            to="/new"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 transition-all duration-200 relative ${
                isActive ? 'text-brand-500' : 'text-slate-600 hover:text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`w-6 h-6 mb-0.5 rounded-full flex items-center justify-center transition-all duration-200 ${
                    isActive ? 'bg-brand-500 scale-110 shadow-lg shadow-brand-500/40' : 'border-2 border-current'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-xs font-medium">Post</span>
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-brand-500 animate-dot-expand" />
                )}
              </>
            )}
          </NavLink>

          <NavLink
            to="/messages"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 transition-all duration-200 relative ${
                isActive ? 'text-brand-500' : 'text-slate-600 hover:text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <svg
                  className={`w-6 h-6 mb-0.5 transition-all duration-200 ${isActive ? 'nav-icon-active scale-110' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={isActive ? 2.5 : 2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="text-xs font-medium">Chat</span>
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-brand-500 animate-dot-expand" />
                )}
              </>
            )}
          </NavLink>
        </div>
      </nav>

      {/* Secret Mini Game */}
      {showGame && <FoodGame onClose={() => setShowGame(false)} />}
    </div>
  )
}
