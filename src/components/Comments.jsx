import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Comments({ postId, comments, onCommented }) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return

    setSending(true)
    const { error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: user.id, text: text.trim() })

    if (!error) {
      setText('')
      onCommented?.()
    }
    setSending(false)
  }

  const visibleComments = expanded ? comments : comments.slice(0, 2)
  const hasMore = comments.length > 2 && !expanded

  return (
    <div className="space-y-2">
      {comments.length > 0 && (
        <div className="space-y-1.5">
          {visibleComments.map((c) => (
            <div key={c.id} className="flex gap-2 text-sm">
              <span className="font-medium text-slate-300 shrink-0">{c.user_name}</span>
              <span className="text-slate-400">{c.text}</span>
            </div>
          ))}
          {hasMore && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
            >
              View all {comments.length} comments
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 bg-slate-700/50 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 border border-slate-700 focus:border-brand-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="text-sm font-medium text-brand-500 disabled:text-slate-600 transition-colors"
        >
          Post
        </button>
      </form>
    </div>
  )
}
