import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const RECIPE_PREFIX = '__recipe__'

export default function PostSharePreview({ postId }) {
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('posts')
      .select('id, image_url, caption, user_id, profiles(display_name, avatar_url)')
      .eq('id', postId)
      .single()
      .then(({ data }) => {
        setPost(data || null)
        setLoading(false)
      })
  }, [postId])

  if (loading) {
    return (
      <div className="w-48 h-16 rounded-xl bg-white/5 animate-pulse" />
    )
  }

  if (!post) {
    return (
      <div className="w-48 rounded-xl bg-white/5 border border-white/8 px-3 py-2 text-xs text-slate-500 italic">
        Post no longer available
      </div>
    )
  }

  const authorName = post.profiles?.display_name || 'Unknown'
  const captionRaw = post.caption || ''
  const captionText = captionRaw.startsWith(RECIPE_PREFIX)
    ? (() => { try { return '🍳 ' + JSON.parse(captionRaw.slice(RECIPE_PREFIX.length)).name } catch { return '🍳 Recipe' } })()
    : captionRaw

  return (
    <button
      onClick={() => navigate(`/u/${post.user_id}`)}
      className="flex gap-2 w-52 rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-left active:scale-[0.98]"
    >
      <img
        src={post.image_url}
        alt=""
        className="w-14 h-14 object-cover shrink-0"
      />
      <div className="flex flex-col justify-center py-1.5 pr-2 min-w-0">
        <span className="text-xs font-semibold text-slate-300 truncate">{authorName}</span>
        {captionText && (
          <span className="text-xs text-slate-500 truncate leading-snug mt-0.5">{captionText}</span>
        )}
      </div>
    </button>
  )
}
