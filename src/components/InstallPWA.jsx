import { useState, useEffect } from 'react'

const DISMISSED_KEY = 'mmmh_install_dismissed'

const isRunningInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream

// ══════════════════════════════════════════════════════════════════════════════
export default function InstallPWA() {
  const [show,      setShow]      = useState(false)
  const [iosMode,   setIosMode]   = useState(false)
  const [deferredPrompt, setDeferred] = useState(null)

  useEffect(() => {
    // Already installed as PWA — never show
    if (isRunningInstalled()) return
    // Already dismissed — never show
    if (localStorage.getItem(DISMISSED_KEY)) return

    if (isIOS()) {
      // iOS doesn't fire beforeinstallprompt — show manual instructions after 4s
      setIosMode(true)
      const t = setTimeout(() => setShow(true), 4000)
      return () => clearTimeout(t)
    }

    // Android / Desktop Chrome — capture the native prompt
    const handler = e => {
      e.preventDefault()
      setDeferred(e)
      // Delay slightly so user settles into the app first
      setTimeout(() => setShow(true), 4000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setShow(false)
  }

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') dismiss()
    // if dismissed by user in native dialog, keep our banner visible
  }

  if (!show) return null

  return (
    <div className="fixed bottom-[4.5rem] inset-x-3 z-[60] animate-slide-in-up pointer-events-auto">
      <div className="bg-[#111c35] border border-white/10 rounded-2xl p-4 flex items-start gap-3 shadow-2xl shadow-black/50">
        {/* App icon */}
        <div className="w-12 h-12 rounded-2xl bg-brand-500/15 border border-brand-500/20 flex items-center justify-center shrink-0 text-2xl font-bold"
          style={{ color: '#f97316', textShadow: '0 0 12px rgba(249,115,22,0.4)' }}>
          m
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white leading-tight">Add mmmh to your Home Screen</p>

          {iosMode ? (
            <>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Tap{' '}
                <span className="inline-flex items-center gap-0.5 text-slate-300">
                  {/* Share icon */}
                  <svg className="w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                  </svg>
                  {' '}Share
                </span>
                {' '}then{' '}
                <span className="text-slate-300 font-semibold">Add to Home Screen</span>
              </p>
              <p className="text-xs text-slate-600 mt-0.5">Works best as an app 🚀</p>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500 mt-0.5">Get the full app experience — works offline too</p>
              <button
                type="button"
                onClick={install}
                className="mt-2 px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all active:scale-95 shadow-md shadow-brand-500/25"
              >
                Install
              </button>
            </>
          )}
        </div>

        {/* Close */}
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 w-7 h-7 rounded-full bg-white/8 hover:bg-white/15 text-slate-500 hover:text-slate-300 flex items-center justify-center text-base transition-all mt-0.5"
        >
          ×
        </button>
      </div>
    </div>
  )
}
