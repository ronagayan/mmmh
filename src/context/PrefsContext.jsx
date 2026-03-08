import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import TRANSLATIONS from '../lib/translations'

const PrefsContext = createContext(null)

// ── Safe localStorage helpers ──────────────────────────────
function readPref(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
function writePref(key, value) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

// ── Provider ───────────────────────────────────────────────
export function PrefsProvider({ children }) {
  // Read initial values synchronously so there's no flash on first render
  const [theme, setThemeState] = useState(() => readPref('mmmh_theme', 'night'))
  const [lang,  setLangState]  = useState(() => readPref('mmmh_lang',  'en'))

  // Apply theme to DOM
  useEffect(() => {
    if (theme === 'day') {
      document.documentElement.setAttribute('data-theme', 'day')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    writePref('mmmh_theme', theme)
  }, [theme])

  // Apply language / directionality to DOM
  useEffect(() => {
    document.documentElement.setAttribute('lang', lang)
    document.documentElement.setAttribute('dir', lang === 'he' ? 'rtl' : 'ltr')
    writePref('mmmh_lang', lang)
  }, [lang])

  const setTheme = useCallback((t) => setThemeState(t), [])
  const setLang  = useCallback((l) => setLangState(l),  [])

  // Translation lookup — falls back to English, then the raw key
  const t = useCallback(
    (key) => TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en?.[key] ?? key,
    [lang],
  )

  return (
    <PrefsContext.Provider value={{ theme, setTheme, lang, setLang, t }}>
      {children}
    </PrefsContext.Provider>
  )
}

// ── Hook ───────────────────────────────────────────────────
export const usePrefs = () => {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs must be used inside <PrefsProvider>')
  return ctx
}
