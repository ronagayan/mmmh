import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'

const MIN = -5
const MAX = 10

export default function RatingSlider({ postId, existingRating, onRated }) {
  const { user } = useAuth()
  const { lang } = usePrefs()
  const isRTL = lang === 'he'
  const [value, setValue] = useState(existingRating ?? 5)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(existingRating != null)

  const handleSubmit = async () => {
    setSubmitting(true)
    const { error } = await supabase
      .from('ratings')
      .upsert(
        { post_id: postId, user_id: user.id, rating: value },
        { onConflict: 'post_id,user_id' }
      )

    if (!error) {
      setSubmitted(true)
      onRated?.()
    }
    setSubmitting(false)
  }

  const getValueColor = () => {
    if (value < 0) return '#f87171'
    if (value <= 3) return '#fb923c'
    if (value <= 6) return '#facc15'
    return '#4ade80'
  }

  const trackPercent = ((value - MIN) / (MAX - MIN)) * 100
  const direction = isRTL ? 'to left' : 'to right'
  const trackBg = `linear-gradient(${direction}, ${getValueColor()} ${trackPercent}%, rgba(255,255,255,0.08) ${trackPercent}%)`

  return (
    <div className="space-y-2">
      {/* Value label */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Rate this dish</span>
        <span
          className="text-xl font-bold transition-colors duration-200"
          style={{ color: getValueColor() }}
        >
          {value > 0 ? `+${value}` : value} מ
        </span>
      </div>

      {/* Slider + button */}
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={MIN}
          max={MAX}
          value={value}
          onChange={(e) => {
            setValue(Number(e.target.value))
            setSubmitted(false)
          }}
          className="flex-1"
          style={{ background: trackBg }}
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || submitted}
          className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95 min-w-[52px] ${
            submitted
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-500/25'
          }`}
        >
          {submitted ? '✓' : submitting ? '…' : 'Rate'}
        </button>
      </div>
    </div>
  )
}
