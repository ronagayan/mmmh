import { useState, useEffect, useRef, useCallback } from 'react'

const FOODS = ['🍕', '🍔', '🌮', '🍜', '🍣', '🍩', '🍰', '🥗', '🌯', '🍦', '🥩', '🥐', '🍇', '🍓', '🫐']
const BAD_ITEMS = ['💩', '🤢', '🧟']
const GAME_DURATION = 30
const GRID_SIZE = 9 // 3×3
const POP_DURATION = 1400 // ms each item stays visible

const HIGH_SCORE_KEY = 'mmmh_food_game_hs'

function getHighScore() {
  try { return parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10) } catch { return 0 }
}
function setHighScore(s) {
  try { localStorage.setItem(HIGH_SCORE_KEY, String(s)) } catch {}
}

// Each cell: { id, emoji, isBad, visible, popping }
function makeEmpty() {
  return Array.from({ length: GRID_SIZE }, (_, i) => ({
    id: i, emoji: null, isBad: false, visible: false, popping: false,
  }))
}

export default function FoodGame({ onClose }) {
  const [phase, setPhase] = useState('idle') // idle | countdown | playing | over
  const [countdown, setCountdown] = useState(3)
  const [cells, setCells] = useState(makeEmpty())
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [lives, setLives] = useState(3)
  const [highScore, setHighScoreState] = useState(getHighScore())
  const [hits, setHits] = useState([]) // { id, x, y, emoji }
  const [shake, setShake] = useState(false)

  const timersRef = useRef({}) // cellId → clearTimeout
  const gameTickRef = useRef(null)
  const countdownRef = useRef(null)
  const spawnRef = useRef(null)
  const livesRef = useRef(3)
  const phaseRef = useRef('idle')

  phaseRef.current = phase
  livesRef.current = lives

  // ── Cleanup ────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    Object.values(timersRef.current).forEach(clearTimeout)
    timersRef.current = {}
    clearInterval(gameTickRef.current)
    clearInterval(countdownRef.current)
    clearInterval(spawnRef.current)
  }, [])

  useEffect(() => () => clearAll(), [clearAll])

  // ── Spawn logic ────────────────────────────────────────────
  const spawnItem = useCallback(() => {
    if (phaseRef.current !== 'playing') return
    setCells(prev => {
      const empty = prev.filter(c => !c.visible)
      if (empty.length === 0) return prev
      const cell = empty[Math.floor(Math.random() * empty.length)]
      const isBad = Math.random() < 0.15
      const emoji = isBad
        ? BAD_ITEMS[Math.floor(Math.random() * BAD_ITEMS.length)]
        : FOODS[Math.floor(Math.random() * FOODS.length)]

      const next = prev.map(c =>
        c.id === cell.id ? { ...c, emoji, isBad, visible: true, popping: false } : c
      )

      // Auto-hide after POP_DURATION if not tapped
      if (timersRef.current[cell.id]) clearTimeout(timersRef.current[cell.id])
      timersRef.current[cell.id] = setTimeout(() => {
        setCells(p => p.map(c => c.id === cell.id && c.visible ? { ...c, visible: false, emoji: null } : c))
        // Miss a good item → lose life
        if (!isBad && phaseRef.current === 'playing') {
          setLives(l => {
            const next = l - 1
            livesRef.current = next
            if (next <= 0) endGame()
            return next
          })
          setShake(true)
          setTimeout(() => setShake(false), 400)
        }
      }, POP_DURATION)

      return next
    })
  }, [])

  const endGame = useCallback(() => {
    clearAll()
    setPhase('over')
    setScore(s => {
      const hs = getHighScore()
      if (s > hs) { setHighScore(s); setHighScoreState(s) }
      return s
    })
    setCells(makeEmpty())
  }, [clearAll])

  // ── Start game ─────────────────────────────────────────────
  const startCountdown = () => {
    setPhase('countdown')
    setCountdown(3)
    let c = 3
    countdownRef.current = setInterval(() => {
      c -= 1
      setCountdown(c)
      if (c <= 0) {
        clearInterval(countdownRef.current)
        startPlaying()
      }
    }, 900)
  }

  const startPlaying = () => {
    setPhase('playing')
    setScore(0)
    setTimeLeft(GAME_DURATION)
    setLives(3)
    livesRef.current = 3
    setCells(makeEmpty())
    hits.length = 0
    setHits([])

    // Game timer
    let t = GAME_DURATION
    gameTickRef.current = setInterval(() => {
      t -= 1
      setTimeLeft(t)
      if (t <= 0) endGame()
    }, 1000)

    // Spawn interval (speeds up as time decreases)
    let spawnDelay = 900
    spawnRef.current = setInterval(() => {
      spawnItem()
      // Gradually speed up — but we can't change interval dynamically easily,
      // so we spawn 1-2 items at a time based on time remaining
      if (t < 15) spawnItem()
    }, spawnDelay)
  }

  // ── Tap a cell ─────────────────────────────────────────────
  const handleTap = (cell, e) => {
    if (phase !== 'playing' || !cell.visible) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2

    // Clear auto-hide
    if (timersRef.current[cell.id]) {
      clearTimeout(timersRef.current[cell.id])
      delete timersRef.current[cell.id]
    }

    setCells(prev => prev.map(c => c.id === cell.id ? { ...c, visible: false, popping: true, emoji: null } : c))

    if (cell.isBad) {
      // Tapped bad item → lose life
      setLives(l => {
        const next = l - 1
        livesRef.current = next
        if (next <= 0) endGame()
        return next
      })
      setHits(h => [...h, { id: Date.now(), x, y, emoji: cell.emoji, bad: true }])
      setShake(true)
      setTimeout(() => setShake(false), 400)
    } else {
      setScore(s => s + 1)
      setHits(h => [...h, { id: Date.now(), x, y, emoji: cell.emoji, bad: false }])
      // Remove floater after anim
      setTimeout(() => setHits(h => h.filter(f => f.id !== Date.now())), 800)
    }
  }

  const timerPct = (timeLeft / GAME_DURATION) * 100
  const timerColor = timeLeft > 15 ? '#f97316' : timeLeft > 8 ? '#f59e0b' : '#ef4444'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget && phase !== 'playing') onClose() }}
      >
        <div
          className={`relative w-full max-w-sm bg-[#0d1525] rounded-3xl border border-white/10 overflow-hidden shadow-2xl shadow-black/60 transition-transform duration-100 ${shake ? 'animate-shake' : ''}`}
        >
          {/* Header glow */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />

          {/* Close */}
          {phase !== 'playing' && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 text-slate-400 flex items-center justify-center text-lg transition-all z-10"
            >
              ×
            </button>
          )}

          <div className="p-5">
            {/* Title */}
            <div className="text-center mb-4">
              <div className="text-3xl mb-0.5">🍽️</div>
              <h2 className="text-xl font-bold text-white" style={{ textShadow: '0 0 20px rgba(249,115,22,0.4)' }}>
                Food Rush
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">Tap the food, dodge the grossness</p>
            </div>

            {/* ── IDLE ──────────────────────────────────────── */}
            {phase === 'idle' && (
              <div className="space-y-4 animate-fade-in">
                {/* HowTo */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { e: '🍕', t: 'Tap food', sub: '+1 point' },
                    { e: '💩', t: 'Dodge junk', sub: '−1 life' },
                    { e: '💨', t: 'Don\'t miss', sub: '−1 life' },
                  ].map(({ e, t, sub }) => (
                    <div key={t} className="bg-white/5 rounded-2xl py-3 px-2">
                      <div className="text-2xl mb-1">{e}</div>
                      <div className="text-xs font-semibold text-slate-300">{t}</div>
                      <div className="text-xs text-slate-600">{sub}</div>
                    </div>
                  ))}
                </div>
                {highScore > 0 && (
                  <div className="text-center">
                    <span className="text-xs text-slate-600">Best: </span>
                    <span className="text-sm font-bold text-brand-400">🏆 {highScore}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={startCountdown}
                  className="w-full py-3.5 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-lg transition-all active:scale-[0.97] shadow-lg shadow-brand-500/30"
                >
                  Play!
                </button>
              </div>
            )}

            {/* ── COUNTDOWN ─────────────────────────────────── */}
            {phase === 'countdown' && (
              <div className="flex flex-col items-center justify-center py-8 gap-2 animate-fade-in">
                <div
                  key={countdown}
                  className="text-8xl font-black text-brand-500 animate-pop-in"
                  style={{ textShadow: '0 0 40px rgba(249,115,22,0.5)' }}
                >
                  {countdown === 0 ? '🍽️' : countdown}
                </div>
                <p className="text-slate-500 text-sm">Get ready…</p>
              </div>
            )}

            {/* ── PLAYING ───────────────────────────────────── */}
            {phase === 'playing' && (
              <div className="space-y-3 animate-fade-in">
                {/* HUD */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span key={i} className={`text-lg transition-all duration-200 ${i < lives ? 'opacity-100' : 'opacity-20 grayscale'}`}>
                        ❤️
                      </span>
                    ))}
                  </div>
                  <div className="text-2xl font-black text-white">{score}</div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke={timerColor} strokeWidth={2.5}>
                      <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
                    </svg>
                    <span className="text-sm font-bold" style={{ color: timerColor }}>{timeLeft}s</span>
                  </div>
                </div>

                {/* Timer bar */}
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${timerPct}%`, background: timerColor }}
                  />
                </div>

                {/* Grid */}
                <div className="grid grid-cols-3 gap-3">
                  {cells.map(cell => (
                    <button
                      key={cell.id}
                      type="button"
                      onClick={(e) => handleTap(cell, e)}
                      className="aspect-square rounded-2xl flex items-center justify-center text-4xl relative overflow-hidden transition-all select-none"
                      style={{
                        background: cell.visible
                          ? cell.isBad
                            ? 'rgba(239,68,68,0.12)'
                            : 'rgba(249,115,22,0.10)'
                          : 'rgba(255,255,255,0.04)',
                        border: cell.visible
                          ? cell.isBad
                            ? '1.5px solid rgba(239,68,68,0.3)'
                            : '1.5px solid rgba(249,115,22,0.25)'
                          : '1.5px solid rgba(255,255,255,0.07)',
                        transform: cell.visible ? 'scale(1)' : 'scale(0.95)',
                      }}
                    >
                      {cell.visible && (
                        <span
                          className="animate-pop-in"
                          style={{ filter: cell.isBad ? 'drop-shadow(0 0 8px rgba(239,68,68,0.7))' : 'drop-shadow(0 0 6px rgba(249,115,22,0.5))' }}
                        >
                          {cell.emoji}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── GAME OVER ─────────────────────────────────── */}
            {phase === 'over' && (
              <div className="space-y-4 animate-fade-in-up text-center">
                <div className="text-5xl animate-float">{score >= 15 ? '🏆' : score >= 8 ? '🎉' : '😅'}</div>
                <div>
                  <p className="text-slate-500 text-sm">Your score</p>
                  <p className="text-6xl font-black text-white mt-1" style={{ textShadow: '0 0 30px rgba(249,115,22,0.4)' }}>
                    {score}
                  </p>
                </div>
                {score >= highScore && score > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-400 text-sm font-semibold animate-scale-in">
                    🏆 New High Score!
                  </div>
                )}
                {score < highScore && (
                  <p className="text-xs text-slate-600">Best: {highScore}</p>
                )}
                <p className="text-xs text-slate-600">
                  {score >= 20 ? 'Absolute legend 👑' : score >= 12 ? 'Nice reflexes! 🔥' : score >= 6 ? 'Getting the hang of it! 💪' : 'Keep trying! 🍕'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={startCountdown}
                    className="flex-1 py-3 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold transition-all active:scale-[0.97] shadow-lg shadow-brand-500/25"
                  >
                    Play Again
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 rounded-2xl bg-white/8 hover:bg-white/12 text-slate-300 font-semibold transition-all active:scale-[0.97]"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating hit indicators (portalled to viewport) */}
      {hits.map(hit => (
        <div
          key={hit.id}
          className="fixed pointer-events-none z-[200] text-2xl font-black select-none"
          style={{
            left: hit.x,
            top: hit.y,
            transform: 'translate(-50%, -50%)',
            animation: 'floatUp 0.7s ease-out forwards',
            color: hit.bad ? '#ef4444' : '#f97316',
          }}
        >
          {hit.bad ? '−1 💀' : `${hit.emoji}`}
        </div>
      ))}

      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
          100% { opacity: 0; transform: translate(-50%, -120%) scale(0.8); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-5px); }
          80%       { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </>
  )
}
