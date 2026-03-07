import { useState, useRef } from 'react'

// ── Slide definitions ──────────────────────────────────────────────────────
const SLIDES = [
  {
    emoji: '🍽️',
    title: 'Welcome to mmmh',
    body: 'The place where food lovers share, rate, and discover dishes together with friends.',
    color: '#f97316',
    bg: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(249,115,22,0.14) 0%, transparent 70%)',
  },
  {
    emoji: '🍕',
    title: 'Explore the Feed',
    body: 'See what your friends are eating. Rate their dishes with a score that actually reflects the experience.',
    color: '#f59e0b',
    bg: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(245,158,11,0.14) 0%, transparent 70%)',
  },
  {
    emoji: '📸',
    title: 'Share your Food',
    body: 'Post a quick snap or write a full recipe — ingredients, step-by-step instructions, and all your tips.',
    color: '#22c55e',
    bg: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(34,197,94,0.14) 0%, transparent 70%)',
  },
  {
    emoji: '💬',
    title: 'Chat about Food',
    body: 'Message friends about the dishes you love. All conversations are end-to-end encrypted.',
    color: '#3b82f6',
    bg: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(59,130,246,0.14) 0%, transparent 70%)',
  },
  {
    emoji: '🤫',
    title: 'Psst… there\'s a secret',
    body: 'Something is hidden in the app. Tap the logo a few times fast and see what happens.',
    color: '#a855f7',
    bg: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(168,85,247,0.14) 0%, transparent 70%)',
    isLast: true,
  },
]

const LS_KEY = 'mmmh_onboarded'
export const hasSeenOnboarding = () => { try { return !!localStorage.getItem(LS_KEY) } catch { return false } }
const markOnboarded = () => { try { localStorage.setItem(LS_KEY, '1') } catch {} }

// ══════════════════════════════════════════════════════════════════════════════
export default function OnboardingGuide({ onDone }) {
  const [idx, setIdx]       = useState(0)
  const [exiting, setExit]  = useState(false)
  const touchX              = useRef(null)

  const slide  = SLIDES[idx]
  const isLast = idx === SLIDES.length - 1

  const goTo = (next) => {
    if (next < 0 || next >= SLIDES.length) return
    setExit(true)
    setTimeout(() => { setIdx(next); setExit(false) }, 180)
  }

  const finish = () => {
    markOnboarded()
    onDone()
  }

  const next = () => isLast ? finish() : goTo(idx + 1)
  const skip = () => finish()

  // Touch swipe
  const onTouchStart = e => { touchX.current = e.touches[0].clientX }
  const onTouchEnd   = e => {
    if (touchX.current === null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (dx < -40 && !isLast) goTo(idx + 1)
    if (dx >  40 && idx > 0) goTo(idx - 1)
    touchX.current = null
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col select-none"
      style={{ background: '#080d18' }}
    >
      {/* Per-slide top glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{ background: slide.bg }}
      />

      {/* Skip */}
      {!isLast && (
        <button
          type="button"
          onClick={skip}
          className="absolute top-5 right-5 z-10 text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors"
        >
          Skip
        </button>
      )}

      {/* Step counter */}
      <div className="absolute top-5 left-5 z-10 text-xs text-slate-600 font-semibold tabular-nums">
        {idx + 1} / {SLIDES.length}
      </div>

      {/* Slide content */}
      <div
        key={idx}
        className={`relative flex-1 flex flex-col items-center justify-center px-8 text-center transition-opacity duration-180 ${exiting ? 'opacity-0' : 'opacity-100 animate-fade-in-up'}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Emoji */}
        <div
          className="text-[88px] mb-8 animate-float"
          style={{ filter: `drop-shadow(0 0 40px ${slide.color}55)` }}
        >
          {slide.emoji}
        </div>

        {/* Text */}
        <h1 className="text-2xl font-bold text-white mb-3 leading-tight">{slide.title}</h1>
        <p className="text-slate-400 text-base leading-relaxed max-w-xs">{slide.body}</p>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 px-6 pb-10 space-y-5">
        {/* Pill dots */}
        <div className="flex items-center gap-2 justify-center">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className="rounded-full transition-all duration-300"
              style={{
                height: 8,
                width:  i === idx ? 24 : 8,
                background: i === idx ? slide.color : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={next}
          className="w-full py-4 rounded-2xl font-bold text-white text-lg transition-all active:scale-[0.97]"
          style={{
            background: slide.color,
            boxShadow: `0 8px 32px ${slide.color}45`,
          }}
        >
          {isLast ? "Let's go! 🚀" : 'Next →'}
        </button>
      </div>
    </div>
  )
}
