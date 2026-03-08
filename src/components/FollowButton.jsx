import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function FollowButton({ userId, size = 'md' }) {
  const { user } = useAuth()
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || userId === user.id) return
    supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setIsFollowing(!!data)
        setLoading(false)
      })
  }, [userId, user])

  if (!user || userId === user.id) return null

  const toggle = async () => {
    const next = !isFollowing
    setIsFollowing(next)
    if (!next) {
      await supabase.from('follows').delete()
        .eq('follower_id', user.id)
        .eq('following_id', userId)
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: userId })
    }
  }

  const sizeClasses = size === 'sm'
    ? 'px-3 py-1 text-xs rounded-full'
    : 'px-4 py-1.5 text-sm rounded-full'

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`${sizeClasses} font-semibold transition-all active:scale-95 disabled:opacity-40 shrink-0 ${
        isFollowing
          ? 'bg-white/8 border border-white/15 text-slate-300 hover:border-red-400/40 hover:text-red-400'
          : 'bg-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-500/25'
      }`}
    >
      {loading ? '…' : isFollowing ? 'Following' : 'Follow'}
    </button>
  )
}
