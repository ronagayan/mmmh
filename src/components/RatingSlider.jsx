import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function RatingSlider({ postId, existingRating, onRated }) {
  const { user } = useAuth()
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

  const getColor = () => {
    if (value < 0) return 'text-red-400'
    if (value <= 3) return 'text-orange-400'
    if (value <= 6) return 'text-yellow-400'
    return 'text-green-400'
  }

  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={-5}
        max={10}
        value={value}
        onChange={(e) => {
          setValue(Number(e.target.value))
          setSubmitted(false)
        }}
        className="flex-1 accent-brand-500 h-2"
      />
      <span className={`font-bold text-lg min-w-[3rem] text-right ${getColor()}`}>
        {value} מ
      </span>
      <button
        onClick={handleSubmit}
        disabled={submitting || submitted}
        className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
          submitted
            ? 'bg-green-600/20 text-green-400'
            : 'bg-brand-500 text-white hover:bg-brand-600 active:scale-95'
        }`}
      >
        {submitted ? '✓' : submitting ? '...' : 'Rate'}
      </button>
    </div>
  )
}
