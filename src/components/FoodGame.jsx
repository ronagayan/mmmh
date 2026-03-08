import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ── Constants ──────────────────────────────────────────────────────────────
const FOODS    = ['🍕','🍔','🌮','🍜','🍣','🍩','🍰','🥗','🌯','🍦','🥩','🥐','🍇','🍓','🫐','🥨','🧇','🍱']
const BAD      = ['💩','🤢','🧟','☠️']
const GAME_SEC = 30
const CELLS    = 9

// ── Difficulty tiers (keyed by elapsed seconds) ────────────────────────────
const TIERS = [
  { tier: 0, label: 'Easy',   icon: '🌶',      color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   interval: 900,  pop: 1400, badChance: 0.12, extra: false },
  { tier: 1, label: 'Hot',    icon: '🌶🌶',    color: '#f97316', bg: 'rgba(249,115,22,0.12)',  interval: 640,  pop: 1050, badChance: 0.20, extra: false },
  { tier: 2, label: 'Spicy',  icon: '🌶🌶🌶',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   interval: 420,  pop: 780,  badChance: 0.28, extra: true  },
  { tier: 3, label: 'PANIC!', icon: '🔥',       color: '#ec4899', bg: 'rgba(236,72,153,0.12)',  interval: 290,  pop: 560,  badChance: 0.36, extra: true  },
]

function getTier(elapsed) {
  if (elapsed < 8)  return TIERS[0]
  if (elapsed < 17) return TIERS[1]
  if (elapsed < 24) return TIERS[2]
  return TIERS[3]
}

// ── Leaderboard helpers ────────────────────────────────────────────────────
const HS_KEY = 'mmmh_food_game_hs'

function loadHS()  { try { return parseInt(localStorage.getItem(HS_KEY) || '0', 10) } catch { return 0 } }
function saveHS(s) { try { localStorage.setItem(HS_KEY, String(s)) } catch {} }

async function fetchBoard() {
  const { data } = await supabase
    .from('game_scores')
    .select('id, player_name, score, created_at')
    .order('score', { ascending: false })
    .limit(10)
  return (data || []).map(e => ({
    id: e.id,
    name: e.player_name,
    score: e.score,
    date: new Date(e.created_at).toLocaleDateString(),
  }))
}

// ── Grid helpers ───────────────────────────────────────────────────────────
const emptyGrid = () =>
  Array.from({ length: CELLS }, (_, i) => ({ id: i, emoji: null, isBad: false, visible: false }))

// ══════════════════════════════════════════════════════════════════════════
export default function FoodGame({ onClose }) {
  const { user } = useAuth()
  // ── UI state ─────────────────────────────────────────────────────────
  const [phase,        setPhase]        = useState('idle')  // idle|countdown|playing|over
  const [countdown,    setCountdown]    = useState(3)
  const [cells,        setCells]        = useState(emptyGrid)
  const [score,        setScore]        = useState(0)
  const [timeLeft,     setTimeLeft]     = useState(GAME_SEC)
  const [lives,        setLives]        = useState(3)
  const [curTier,      setCurTier]      = useState(TIERS[0])
  const [tierBanner,   setTierBanner]   = useState(null)
  const [hits,         setHits]         = useState([])
  const [shake,        setShake]        = useState(false)
  const [highScore,    setHighScore]    = useState(loadHS)

  // Game-over sub-phases
  const [overSub,   setOverSub]   = useState('entry') // entry|board
  const [nameInput, setNameInput] = useState('')
  const [board,     setBoard]     = useState([])
  const [newIdx,    setNewIdx]    = useState(-1)

  // ── Mutable refs (no re-render needed) ───────────────────────────────
  const cellTimers  = useRef({})   // cellId → clearTimeout handle
  const tickRef     = useRef(null)
  const countRef    = useRef(null)
  const spawnRef    = useRef(null)
  const phaseRef    = useRef('idle')
  const elapsedRef  = useRef(0)
  const tierIdxRef  = useRef(0)
  const scoreRef    = useRef(0)
  const livesRef    = useRef(3)

  phaseRef.current = phase

  // Load leaderboard on first open
  useEffect(() => { fetchBoard().then(setBoard) }, [])

  // ── Cleanup ───────────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    Object.values(cellTimers.current).forEach(clearTimeout)
    cellTimers.current = {}
    clearInterval(tickRef.current)
    clearInterval(countRef.current)
    clearTimeout(spawnRef.current)
  }, [])

  useEffect(() => () => clearAll(), [clearAll])

  // ── End game ──────────────────────────────────────────────────────────
  const endGame = useCallback(() => {
    clearAll()
    const s = scoreRef.current
    if (s > loadHS()) { saveHS(s); setHighScore(s) }
    setCells(emptyGrid())
    setPhase('over')
    setOverSub('entry')
    fetchBoard().then(setBoard)
  }, [clearAll])

  // ── Spawn one item with given difficulty params ───────────────────────
  const spawnOne = useCallback((popMs, badChance) => {
    if (phaseRef.current !== 'playing') return
    setCells(prev => {
      const free = prev.filter(c => !c.visible)
      if (!free.length) return prev
      const cell  = free[Math.floor(Math.random() * free.length)]
      const isBad = Math.random() < badChance
      const emoji = isBad
        ? BAD[Math.floor(Math.random() * BAD.length)]
        : FOODS[Math.floor(Math.random() * FOODS.length)]

      if (cellTimers.current[cell.id]) clearTimeout(cellTimers.current[cell.id])
      cellTimers.current[cell.id] = setTimeout(() => {
        setCells(p => p.map(c => c.id === cell.id && c.visible ? { ...c, visible: false, emoji: null } : c))
        // missed a good item
        if (!isBad && phaseRef.current === 'playing') {
          setLives(l => {
            const next = Math.max(0, l - 1)
            livesRef.current = next
            if (next <= 0) endGame()
            return next
          })
          setShake(true)
          setTimeout(() => setShake(false), 400)
        }
      }, popMs)

      return prev.map(c => c.id === cell.id ? { ...c, emoji, isBad, visible: true } : c)
    })
  }, [endGame])

  // ── Recursive spawn loop — self-adjusting interval ────────────────────
  const spawnLoop = useCallback(() => {
    if (phaseRef.current !== 'playing') return
    const tier = getTier(elapsedRef.current)

    // Tier-up notification
    if (tier.tier > tierIdxRef.current) {
      tierIdxRef.current = tier.tier
      setCurTier(tier)
      setTierBanner(tier)
      setTimeout(() => setTierBanner(null), 1700)
    }

    spawnOne(tier.pop, tier.badChance)
    if (tier.extra) spawnOne(tier.pop, tier.badChance)

    spawnRef.current = setTimeout(spawnLoop, tier.interval)
  }, [spawnOne])

  // ── Countdown → play ──────────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    clearAll()
    setPhase('countdown')
    setCountdown(3)
    let c = 3
    countRef.current = setInterval(() => {
      c -= 1
      setCountdown(c)
      if (c <= 0) { clearInterval(countRef.current); startGame() }
    }, 900)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearAll])

  const startGame = useCallback(() => {
    setPhase('playing')
    setScore(0);        scoreRef.current  = 0
    setTimeLeft(GAME_SEC)
    setLives(3);        livesRef.current  = 3
    setCells(emptyGrid())
    setHits([])
    elapsedRef.current  = 0
    tierIdxRef.current  = 0
    setCurTier(TIERS[0])
    setTierBanner(null)

    // Count-down clock
    let t = GAME_SEC
    tickRef.current = setInterval(() => {
      t -= 1
      elapsedRef.current = GAME_SEC - t
      setTimeLeft(t)
      if (t <= 0) endGame()
    }, 1000)

    spawnRef.current = setTimeout(spawnLoop, 500)
  }, [endGame, spawnLoop])

  // ── Tap a cell ────────────────────────────────────────────────────────
  const tap = (cell, e) => {
    if (phase !== 'playing' || !cell.visible) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x    = rect.left + rect.width  / 2
    const y    = rect.top  + rect.height / 2
    const hid  = Date.now() + Math.random()

    if (cellTimers.current[cell.id]) {
      clearTimeout(cellTimers.current[cell.id])
      delete cellTimers.current[cell.id]
    }
    setCells(p => p.map(c => c.id === cell.id ? { ...c, visible: false, emoji: null } : c))

    if (cell.isBad) {
      setLives(l => {
        const next = Math.max(0, l - 1)
        livesRef.current = next
        if (next <= 0) endGame()
        return next
      })
      setHits(h => [...h, { id: hid, x, y, label: '−1 💀', color: '#ef4444' }])
      setShake(true)
      setTimeout(() => setShake(false), 400)
    } else {
      setScore(s => { scoreRef.current = s + 1; return s + 1 })
      setHits(h => [...h, { id: hid, x, y, label: cell.emoji, color: '#f97316' }])
    }
    setTimeout(() => setHits(h => h.filter(f => f.id !== hid)), 750)
  }

  // ── Submit leaderboard entry ──────────────────────────────────────────
  const submitEntry = async () => {
    const name = nameInput.trim() || 'Anonymous'
    const { data } = await supabase
      .from('game_scores')
      .insert({ user_id: user?.id ?? null, player_name: name, score })
      .select('id')
      .single()
    const newId = data?.id
    const b = await fetchBoard()
    setBoard(b)
    setNewIdx(b.findIndex(e => e.id === newId))
    setOverSub('board')
  }

  // ── Derived ───────────────────────────────────────────────────────────
  const timerPct   = (timeLeft / GAME_SEC) * 100
  const timerColor = timeLeft > 15 ? '#f97316' : timeLeft > 8 ? '#f59e0b' : '#ef4444'
  const isNewHS    = score >= highScore && score > 0

  // ══════════════════════════════════════════════════════════════════════
  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={e => { if (e.target === e.currentTarget && phase !== 'playing') onClose() }}
      >
        <div className={`relative w-full max-w-sm bg-[#0d1525] rounded-3xl border border-white/10 overflow-hidden shadow-2xl shadow-black/60 ${shake ? 'animate-shake' : ''}`}>

          {/* Top glow line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />

          {/* Close (hidden while playing) */}
          {phase !== 'playing' && (
            <button type="button" onClick={onClose}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 text-slate-400 flex items-center justify-center text-lg transition-all">
              ×
            </button>
          )}

          {/* ── Tier-up banner (centered overlay) ─────────────────── */}
          {tierBanner && (
            <div className="absolute inset-x-0 top-1/3 z-20 flex justify-center pointer-events-none">
              <div className="px-6 py-3 rounded-2xl font-black text-xl text-white animate-pop-in"
                style={{
                  background: tierBanner.bg,
                  border: `1.5px solid ${tierBanner.color}50`,
                  boxShadow: `0 0 40px ${tierBanner.color}35`,
                  textShadow: `0 0 20px ${tierBanner.color}`,
                }}>
                {tierBanner.icon} {tierBanner.label}!
              </div>
            </div>
          )}

          <div className="p-5">
            {/* Header */}
            <div className="text-center mb-4">
              <div className="text-3xl mb-0.5">🍽️</div>
              <h2 className="text-xl font-bold text-white" style={{ textShadow: '0 0 20px rgba(249,115,22,0.4)' }}>
                Food Rush
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">Tap the food, dodge the grossness</p>
            </div>

            {/* ── IDLE ──────────────────────────────────────────────── */}
            {phase === 'idle' && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[{ e: '🍕', t: 'Tap food', sub: '+1 point' },
                    { e: '💩', t: 'Dodge junk', sub: '−1 life' },
                    { e: '💨', t: "Don't miss", sub: '−1 life' }]
                    .map(({ e, t, sub }) => (
                      <div key={t} className="bg-white/5 rounded-2xl py-3 px-2">
                        <div className="text-2xl mb-1">{e}</div>
                        <div className="text-xs font-semibold text-slate-300">{t}</div>
                        <div className="text-xs text-slate-600">{sub}</div>
                      </div>
                    ))}
                </div>

                {/* Tier preview */}
                <div className="flex gap-1.5 justify-center">
                  {TIERS.map(t => (
                    <div key={t.tier} className="text-xs px-2.5 py-1 rounded-lg font-bold"
                      style={{ background: t.bg, color: t.color, border: `1px solid ${t.color}30` }}>
                      {t.icon}
                    </div>
                  ))}
                  <span className="text-xs text-slate-600 self-center ml-1">gets harder!</span>
                </div>

                {highScore > 0 && (
                  <p className="text-center text-sm">
                    <span className="text-slate-600 text-xs">Personal best: </span>
                    <span className="font-bold text-brand-400">🏆 {highScore}</span>
                  </p>
                )}

                <button type="button" onClick={startCountdown}
                  className="w-full py-3.5 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-lg transition-all active:scale-[0.97] shadow-lg shadow-brand-500/30">
                  Play!
                </button>

                {/* Leaderboard peek */}
                {board.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-600 text-center">Top scores</p>
                    {board.slice(0, 3).map((e, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/4">
                        <span className="text-sm">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                        <span className="flex-1 text-sm text-slate-300 truncate">{e.name}</span>
                        <span className="font-bold text-slate-300">{e.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── COUNTDOWN ─────────────────────────────────────────── */}
            {phase === 'countdown' && (
              <div className="flex flex-col items-center py-8 gap-2 animate-fade-in">
                <div key={countdown} className="text-8xl font-black text-brand-500 animate-pop-in"
                  style={{ textShadow: '0 0 40px rgba(249,115,22,0.5)' }}>
                  {countdown === 0 ? '🍽️' : countdown}
                </div>
                <p className="text-slate-500 text-sm">Get ready…</p>
              </div>
            )}

            {/* ── PLAYING ───────────────────────────────────────────── */}
            {phase === 'playing' && (
              <div className="space-y-3 animate-fade-in">
                {/* HUD row */}
                <div className="flex items-center justify-between">
                  {/* Lives */}
                  <div className="flex gap-0.5">
                    {[0,1,2].map(i => (
                      <span key={i} className={`text-xl transition-all duration-200 ${i < lives ? '' : 'opacity-15 grayscale'}`}>❤️</span>
                    ))}
                  </div>
                  {/* Score */}
                  <div className="text-3xl font-black text-white leading-none">{score}</div>
                  {/* Tier + timer */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold transition-all duration-500"
                      style={{ background: curTier.bg, color: curTier.color }}>
                      {curTier.icon}
                    </span>
                    <div className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke={timerColor} strokeWidth={2.5}>
                        <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/>
                      </svg>
                      <span className="text-sm font-bold tabular-nums" style={{ color: timerColor }}>{timeLeft}s</span>
                    </div>
                  </div>
                </div>

                {/* Timer bar */}
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${timerPct}%`, background: timerColor }} />
                </div>

                {/* 3×3 Grid */}
                <div className="grid grid-cols-3 gap-3">
                  {cells.map(cell => (
                    <button key={cell.id} type="button" onClick={e => tap(cell, e)}
                      className="aspect-square rounded-2xl flex items-center justify-center text-4xl select-none transition-all duration-100 active:scale-90"
                      style={{
                        background: cell.visible ? (cell.isBad ? 'rgba(239,68,68,0.12)' : 'rgba(249,115,22,0.10)') : 'rgba(255,255,255,0.04)',
                        border:     cell.visible ? (cell.isBad ? '1.5px solid rgba(239,68,68,0.30)' : '1.5px solid rgba(249,115,22,0.25)') : '1.5px solid rgba(255,255,255,0.07)',
                        transform:  cell.visible ? 'scale(1)' : 'scale(0.95)',
                      }}>
                      {cell.visible && (
                        <span className="animate-pop-in"
                          style={{ filter: cell.isBad ? 'drop-shadow(0 0 8px rgba(239,68,68,0.7))' : 'drop-shadow(0 0 6px rgba(249,115,22,0.5))' }}>
                          {cell.emoji}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── OVER: name entry ───────────────────────────────────── */}
            {phase === 'over' && overSub === 'entry' && (
              <div className="space-y-4 animate-fade-in-up">
                <div className="text-center">
                  <div className="text-5xl mb-2 animate-float">
                    {score >= 20 ? '👑' : score >= 12 ? '🏆' : score >= 6 ? '🎉' : '😅'}
                  </div>
                  <p className="text-slate-500 text-sm">Final Score</p>
                  <p className="text-6xl font-black text-white mt-1 tabular-nums"
                    style={{ textShadow: '0 0 30px rgba(249,115,22,0.4)' }}>
                    {score}
                  </p>
                  {isNewHS && (
                    <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-400 text-sm font-semibold animate-scale-in">
                      🏆 New Personal Best!
                    </div>
                  )}
                  {!isNewHS && highScore > 0 && (
                    <p className="text-xs text-slate-600 mt-1">Best: {highScore}</p>
                  )}
                  <p className="text-xs text-slate-600 mt-1.5">
                    {score >= 20 ? 'Absolute legend 👑' : score >= 12 ? 'Nice reflexes! 🔥' : score >= 6 ? 'Getting the hang of it! 💪' : 'Keep trying! 🍕'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Your name for the leaderboard
                  </label>
                  <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitEntry()}
                    placeholder="Anonymous" maxLength={20} autoFocus
                    className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 border border-white/8 focus:border-brand-500/60 focus:outline-none transition-all" />
                </div>

                <button type="button" onClick={submitEntry}
                  className="w-full py-3 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold transition-all active:scale-[0.97] shadow-lg shadow-brand-500/25">
                  See Leaderboard →
                </button>
                <button type="button" onClick={startCountdown}
                  className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 text-sm font-semibold transition-all">
                  Skip & Play Again
                </button>
              </div>
            )}

            {/* ── OVER: leaderboard ─────────────────────────────────── */}
            {phase === 'over' && overSub === 'board' && (
              <div className="space-y-3 animate-fade-in-up">
                <h3 className="text-center font-bold text-slate-200">🏆 Leaderboard</h3>
                <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-hide">
                  {board.length === 0 ? (
                    <p className="text-center text-slate-600 text-sm py-4">No scores yet — you're first! 🎉</p>
                  ) : board.map((entry, i) => (
                    <div key={entry.id ?? i}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${i === newIdx ? 'bg-brand-500/15 border border-brand-500/30' : 'bg-white/4 border border-white/6'}`}>
                      <span className="w-5 text-center text-sm font-black shrink-0"
                        style={{ color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#475569' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${i === newIdx ? 'text-brand-400' : 'text-slate-300'}`}>
                          {entry.name}
                          {i === newIdx && <span className="ml-1 text-xs text-brand-500/60">(you)</span>}
                        </p>
                        <p className="text-xs text-slate-600">{entry.date}</p>
                      </div>
                      <span className={`font-black text-lg tabular-nums shrink-0 ${i === newIdx ? 'text-brand-400' : 'text-slate-300'}`}>
                        {entry.score}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={startCountdown}
                    className="flex-1 py-3 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold transition-all active:scale-[0.97] shadow-lg shadow-brand-500/25">
                    Play Again
                  </button>
                  <button type="button" onClick={onClose}
                    className="flex-1 py-3 rounded-2xl bg-white/8 hover:bg-white/12 text-slate-300 font-semibold transition-all active:scale-[0.97]">
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Floating tap indicators ──────────────────────────────────── */}
      {hits.map(h => (
        <div key={h.id} className="fixed pointer-events-none z-[200] font-black text-2xl select-none"
          style={{ left: h.x, top: h.y, transform: 'translate(-50%,-50%)', color: h.color, animation: 'floatUp 0.7s ease-out forwards' }}>
          {h.label}
        </div>
      ))}

      <style>{`
        @keyframes floatUp {
          0%   { opacity:1; transform:translate(-50%,-50%) scale(1.2); }
          100% { opacity:0; transform:translate(-50%,-130%) scale(0.8); }
        }
        @keyframes shake {
          0%,100%{ transform:translateX(0); }
          20%    { transform:translateX(-8px); }
          40%    { transform:translateX(8px); }
          60%    { transform:translateX(-5px); }
          80%    { transform:translateX(5px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </>
  )
}
