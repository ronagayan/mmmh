import { useState } from 'react'
import { createPortal } from 'react-dom'
import { usePrefs } from '../context/PrefsContext'

const CURRENT_VERSION = '1.5.0'
const STORAGE_KEY = 'mmmh_whats_new_seen'

export function hasSeenWhatsNew() {
  return localStorage.getItem(STORAGE_KEY) === CURRENT_VERSION
}

export function markWhatsNewSeen() {
  localStorage.setItem(STORAGE_KEY, CURRENT_VERSION)
}

const NOTES = {
  en: {
    title: "What's New 🎉",
    version: 'Version 1.5.0',
    cta: 'Let\'s go!',
    items: [
      { icon: '👥', title: 'Follow Friends', desc: 'Follow people and discover new users on the Explore page' },
      { icon: '📰', title: 'Personalised Feed', desc: 'Switch between "For You" and "Following" tabs in your feed' },
      { icon: '🔒', title: 'Post Visibility', desc: 'Choose to share posts publicly or with followers only' },
      { icon: '💬', title: 'Share Posts in Chat', desc: 'Send any post directly into a conversation' },
      { icon: '🍽️', title: 'Food Photos Only', desc: 'AI now checks that only food images get posted' },
      { icon: '🏆', title: 'Global Leaderboard', desc: 'Food Rush scores are now shared with everyone' },
    ],
  },
  he: {
    title: 'מה חדש 🎉',
    version: 'גרסה 1.5.0',
    cta: 'יאללה!',
    items: [
      { icon: '👥', title: 'עקוב אחרי חברים', desc: 'עקוב אחרי אנשים וגלה משתמשים חדשים בדף גלה' },
      { icon: '📰', title: 'פיד מותאם אישית', desc: 'עבור בין "בשבילך" ו"עוקבים" בפיד שלך' },
      { icon: '🔒', title: 'נראות פוסטים', desc: 'בחר לשתף פוסטים בפומבי או לעוקבים בלבד' },
      { icon: '💬', title: 'שיתוף פוסטים בצ\'אט', desc: 'שלח כל פוסט ישירות לשיחה' },
      { icon: '🍽️', title: 'תמונות אוכל בלבד', desc: 'AI בודק שרק תמונות אוכל מתפרסמות' },
      { icon: '🏆', title: 'לוח תוצאות גלובלי', desc: 'ניקודים ב-Food Rush משותפים עכשיו לכולם' },
    ],
  },
}

export default function WhatsNewModal({ onClose }) {
  const { lang } = usePrefs()
  const content = NOTES[lang] || NOTES.en
  const isRTL = lang === 'he'

  const handleClose = () => {
    markWhatsNewSeen()
    onClose()
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      <div
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto bg-[#0d1525] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100">{content.title}</h2>
              <span className="text-xs text-brand-500 font-medium">{content.version}</span>
            </div>
            <button onClick={handleClose} className="text-slate-500 hover:text-slate-300 text-2xl leading-none">×</button>
          </div>
        </div>

        {/* Items */}
        <div className="px-5 py-3 space-y-3 max-h-72 overflow-y-auto scrollbar-hide">
          {content.items.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">{item.icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-200 leading-snug">{item.title}</p>
                <p className="text-xs text-slate-500 leading-snug mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-5 pb-5 pt-3">
          <button
            onClick={handleClose}
            className="w-full py-2.5 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 transition-all active:scale-95 shadow-lg shadow-brand-500/25"
          >
            {content.cta}
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}
