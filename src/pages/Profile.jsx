import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { supabase } from '../lib/supabase'
import { validateImageFile, MAX_AVATAR_SIZE } from '../lib/sanitize'

// ── Avatar presets ──────────────────────────────────────────
const PRESETS = [
  { emoji: '🍕', bg: '#f97316' },
  { emoji: '🍣', bg: '#1d4ed8' },
  { emoji: '🍔', bg: '#15803d' },
  { emoji: '🍜', bg: '#b45309' },
  { emoji: '🍰', bg: '#be185d' },
  { emoji: '🥗', bg: '#065f46' },
  { emoji: '🌮', bg: '#7c3aed' },
  { emoji: '🍦', bg: '#0e7490' },
  { emoji: '🍩', bg: '#c2410c' },
  { emoji: '🥩', bg: '#991b1b' },
  { emoji: '🥑', bg: '#3f6212' },
  { emoji: '🍓', bg: '#be123c' },
]

// ── Canvas preset renderer ──────────────────────────────────
function renderPresetToBlob(preset) {
  return new Promise((resolve, reject) => {
    const SIZE = 256
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    // Background circle
    ctx.fillStyle = preset.bg
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2)
    ctx.fill()
    // Emoji centered with optical baseline nudge
    ctx.font = `${Math.floor(SIZE * 0.55)}px serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(preset.emoji, SIZE / 2, SIZE / 2 + SIZE * 0.04)
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
      'image/png',
    )
  })
}

// ── Helper sub-components ───────────────────────────────────
function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
      {children}
    </h2>
  )
}

function StatusBadge({ status, savedMsg, errorMsg }) {
  if (status === 'idle' || status === 'saving') return null
  const ok = status === 'saved'
  return (
    <span
      className={`text-xs font-medium animate-fade-in ${ok ? 'text-green-400' : 'text-red-400'}`}
    >
      {ok ? savedMsg : errorMsg}
    </span>
  )
}

function TogglePill({ options, value, onChange }) {
  return (
    <div className="flex rounded-xl p-1"
      style={{ background: 'var(--bg-surface, rgba(255,255,255,0.05))', border: '1px solid var(--border-input)' }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
            value === opt.value
              ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {opt.icon && <span className="text-base leading-none">{opt.icon}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function AvatarPicker({ onPick, disabled }) {
  const [picking, setPicking] = useState(null) // id of the one being rendered

  const handlePick = useCallback(async (preset) => {
    if (disabled || picking) return
    setPicking(preset.emoji)
    try {
      const blob = await renderPresetToBlob(preset)
      await onPick(blob)
    } catch (err) {
      console.warn('Avatar preset render failed:', err)
    } finally {
      setPicking(null)
    }
  }, [disabled, onPick, picking])

  return (
    <div className="grid grid-cols-4 gap-3">
      {PRESETS.map((preset) => {
        const isLoading = picking === preset.emoji
        return (
          <button
            key={preset.emoji}
            type="button"
            onClick={() => handlePick(preset)}
            disabled={!!picking || disabled}
            className="relative aspect-square rounded-2xl overflow-hidden transition-all duration-150 active:scale-90 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-50"
            style={{ background: preset.bg }}
            aria-label={preset.emoji}
          >
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <span className="text-3xl flex items-center justify-center w-full h-full select-none">
                {preset.emoji}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Main Profile page ───────────────────────────────────────
export default function Profile() {
  const { user, signOut } = useAuth()
  const { theme, setTheme, lang, setLang, t } = usePrefs()

  const [profile,      setProfile]      = useState(null)
  const [nickInput,    setNickInput]    = useState('')
  const [nickStatus,   setNickStatus]   = useState('idle') // idle|saving|saved|error
  const [avatarStatus, setAvatarStatus] = useState('idle') // idle|saving|saved|error

  const fileInputRef = useRef(null)

  // ── Fetch profile on mount ────────────────────────────────
  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data)
          setNickInput(data.display_name ?? '')
        }
      })
  }, [user])

  // ── Avatar upload (shared by file pick + canvas preset) ───
  const handleAvatarUpload = useCallback(async (blob) => {
    if (!user) return
    setAvatarStatus('saving')
    const path = `${user.id}/avatar.png`
    const { error: upErr } = await supabase.storage
      .from('food-images')
      .upload(path, blob, { upsert: true, contentType: 'image/png' })
    if (upErr) {
      console.error('Avatar upload error:', upErr)
      setAvatarStatus('error')
      setTimeout(() => setAvatarStatus('idle'), 2500)
      return
    }
    const { data: { publicUrl } } = supabase.storage
      .from('food-images')
      .getPublicUrl(path)
    const urlWithBust = `${publicUrl}?t=${Date.now()}`
    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ avatar_url: urlWithBust })
      .eq('id', user.id)
    if (dbErr) {
      console.error('Profile avatar update error:', dbErr)
      setAvatarStatus('error')
    } else {
      setAvatarStatus('saved')
      setProfile((p) => ({ ...p, avatar_url: urlWithBust }))
    }
    setTimeout(() => setAvatarStatus('idle'), 2500)
  }, [user])

  // ── File input change ─────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fileErr = validateImageFile(file, MAX_AVATAR_SIZE)
    if (fileErr) {
      alert(fileErr)
      e.target.value = ''
      return
    }
    handleAvatarUpload(file)
    e.target.value = ''
  }

  // ── Save nickname ─────────────────────────────────────────
  const handleNicknameSave = async () => {
    if (!nickInput.trim() || nickStatus === 'saving') return
    setNickStatus('saving')
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: nickInput.trim() })
      .eq('id', user.id)
    if (error) {
      console.error('Nickname save error:', error)
      setNickStatus('error')
    } else {
      setNickStatus('saved')
      setProfile((p) => ({ ...p, display_name: nickInput.trim() }))
    }
    setTimeout(() => setNickStatus('idle'), 2000)
  }

  // ── Avatar display ────────────────────────────────────────
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url
  const initials  = ((profile?.display_name || user?.email || '?')[0]).toUpperCase()

  const cardStyle = {
    background: 'var(--bg-card)',
    borderColor: 'var(--border-subtle)',
  }

  return (
    <div className="page-enter space-y-5 pb-10">

      {/* Page header */}
      <div className="pt-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('profile_title')}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {t('profile_subtitle')}
        </p>
      </div>

      {/* ── Section 1: Avatar ─────────────────────────────── */}
      <section className="rounded-2xl border p-5 space-y-4" style={cardStyle}>
        <SectionTitle>{t('avatar_section')}</SectionTitle>

        {/* Current avatar + upload button */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-16 h-16 rounded-full ring-2 ring-brand-500/40 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 rounded-full ring-2 ring-brand-500/40 bg-brand-500/20 flex items-center justify-center text-2xl font-bold text-brand-400">
                {initials}
              </div>
            )}
            {/* Saving spinner overlay */}
            {avatarStatus === 'saving' && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarStatus === 'saving'}
              className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white text-sm font-semibold transition-all active:scale-95 shadow-md shadow-brand-500/25"
            >
              {avatarStatus === 'saving' ? t('avatar_saving') : t('avatar_upload_btn')}
            </button>
            <StatusBadge
              status={avatarStatus}
              savedMsg={t('avatar_saved')}
              errorMsg={t('avatar_error')}
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Preset grid label */}
        <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          {t('avatar_pick_emoji')}
        </p>

        <AvatarPicker onPick={handleAvatarUpload} disabled={avatarStatus === 'saving'} />
      </section>

      {/* ── Section 2: Nickname ───────────────────────────── */}
      <section className="rounded-2xl border p-5 space-y-3" style={cardStyle}>
        <SectionTitle>{t('nickname_section')}</SectionTitle>

        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {t('nickname_label')}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={nickInput}
            onChange={(e) => setNickInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNicknameSave()}
            placeholder={t('nickname_placeholder')}
            maxLength={32}
            className="flex-1 min-w-0 rounded-xl px-4 py-3 text-sm font-medium placeholder-slate-600 border focus:border-brand-500/60 focus:outline-none transition-all"
            style={{
              background: 'var(--bg-surface, rgba(255,255,255,0.05))',
              borderColor: 'var(--border-input)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            type="button"
            onClick={handleNicknameSave}
            disabled={nickStatus === 'saving' || !nickInput.trim()}
            className="px-4 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white text-sm font-semibold transition-all active:scale-95 shadow-md shadow-brand-500/25 shrink-0"
          >
            {nickStatus === 'saving' ? t('nickname_saving') : t('nickname_save')}
          </button>
        </div>
        <StatusBadge
          status={nickStatus}
          savedMsg={t('nickname_saved')}
          errorMsg={t('nickname_error')}
        />
      </section>

      {/* ── Section 3: Language ───────────────────────────── */}
      <section className="rounded-2xl border p-5 space-y-3" style={cardStyle}>
        <SectionTitle>{t('lang_section')}</SectionTitle>
        <TogglePill
          options={[
            { value: 'en', label: t('lang_en') },
            { value: 'he', label: t('lang_he') },
          ]}
          value={lang}
          onChange={setLang}
        />
      </section>

      {/* ── Section 4: Theme ──────────────────────────────── */}
      <section className="rounded-2xl border p-5 space-y-3" style={cardStyle}>
        <SectionTitle>{t('theme_section')}</SectionTitle>
        <TogglePill
          options={[
            { value: 'night', icon: '🌙', label: t('theme_night') },
            { value: 'day',   icon: '☀️', label: t('theme_day')   },
          ]}
          value={theme}
          onChange={setTheme}
        />
      </section>

      {/* ── Section 5: Account ────────────────────────────── */}
      <section className="rounded-2xl border p-5" style={cardStyle}>
        <SectionTitle>{t('account_section')}</SectionTitle>
        <button
          type="button"
          onClick={signOut}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] border"
          style={{
            background: 'rgba(239,68,68,0.06)',
            borderColor: 'rgba(239,68,68,0.15)',
            color: '#f87171',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.14)'
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.06)'
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.15)'
          }}
        >
          {t('sign_out')}
        </button>
      </section>

    </div>
  )
}
