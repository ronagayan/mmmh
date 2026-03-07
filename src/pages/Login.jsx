import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'

const FLOATERS = [
  { emoji: '🍕', top: '12%', left: '7%',  delay: '0s',    dur: '4.2s', size: '2.4rem', rot: '-8deg'  },
  { emoji: '🍜', top: '22%', right: '9%', delay: '0.8s',  dur: '5.1s', size: '2rem',   rot: '6deg'   },
  { emoji: '🍣', top: '58%', left: '5%',  delay: '1.3s',  dur: '4.7s', size: '2.2rem', rot: '-5deg'  },
  { emoji: '🍔', top: '68%', right: '7%', delay: '0.4s',  dur: '5.4s', size: '2rem',   rot: '10deg'  },
  { emoji: '🥗', top: '42%', left: '11%', delay: '2s',    dur: '4.4s', size: '1.9rem', rot: '-12deg' },
  { emoji: '🍰', top: '32%', right: '13%',delay: '2.4s',  dur: '3.9s', size: '2.3rem', rot: '4deg'   },
  { emoji: '🌮', top: '78%', left: '18%', delay: '0.6s',  dur: '5.2s', size: '2rem',   rot: '-7deg'  },
  { emoji: '🍦', top: '8%',  right: '18%',delay: '1.6s',  dur: '4.9s', size: '2rem',   rot: '9deg'   },
  { emoji: '🍩', top: '88%', right: '22%',delay: '1.1s',  dur: '4.6s', size: '1.8rem', rot: '-4deg'  },
  { emoji: '🥩', top: '50%', right: '4%', delay: '3s',    dur: '5s',   size: '2.1rem', rot: '7deg'   },
]

export default function Login() {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (user) return <Navigate to="/" />

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)

    const { error: err } =
      mode === 'signin'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password)

    if (err) {
      setError(err.message)
    } else if (mode === 'signup') {
      setNotice('Check your email to confirm your account.')
    }
    setLoading(false)
  }

  const inputClass =
    'w-full bg-white/5 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 border border-white/10 focus:border-brand-500/60 focus:bg-white/8 focus:outline-none transition-all text-sm'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden relative">
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 90% 55% at 50% 45%, rgba(249,115,22,0.11) 0%, transparent 65%)',
        }}
      />

      {/* Floating food emojis */}
      {FLOATERS.map((f, i) => (
        <div
          key={i}
          className="absolute pointer-events-none select-none animate-float"
          style={{
            top: f.top,
            ...(f.left  ? { left:  f.left  } : {}),
            ...(f.right ? { right: f.right } : {}),
            animationDelay: f.delay,
            animationDuration: f.dur,
            fontSize: f.size,
            opacity: 0.28,
            transform: `rotate(${f.rot})`,
          }}
        >
          {f.emoji}
        </div>
      ))}

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-xs">
        {/* Title */}
        <div className="text-center animate-fade-in-up">
          <h1
            className="font-bold leading-none"
            style={{
              fontSize: 'clamp(4.5rem, 20vw, 7rem)',
              color: '#f97316',
              textShadow: '0 0 40px rgba(249,115,22,0.45), 0 0 100px rgba(249,115,22,0.2)',
              letterSpacing: '-0.02em',
            }}
          >
            mmmh
          </h1>
          <p
            className="text-slate-400 mt-2 tracking-widest uppercase text-xs font-medium animate-fade-in"
            style={{ animationDelay: '0.25s', opacity: 0 }}
          >
            Rate food with your friends
          </p>
        </div>

        {/* Email form */}
        <div
          className="w-full animate-fade-in-up"
          style={{ animationDelay: '0.15s', opacity: 0 }}
        >
          {/* Mode toggle */}
          <div className="flex rounded-xl bg-white/5 border border-white/8 p-1 mb-4">
            {['signin', 'signup'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(''); setNotice('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  mode === m
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
            />

            {error && (
              <p className="text-red-400 text-xs px-1 animate-fade-in">{error}</p>
            )}
            {notice && (
              <p className="text-green-400 text-xs px-1 animate-fade-in">{notice}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg shadow-brand-500/20"
            >
              {loading ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-xs text-slate-600">or</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {/* Google */}
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-800 font-semibold px-5 py-3 rounded-xl shadow-xl transition-all duration-200 hover:-translate-y-0.5 active:scale-95 active:translate-y-0"
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  )
}
