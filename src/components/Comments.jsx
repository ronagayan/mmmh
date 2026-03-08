import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Comments({ postId, comments: initialComments, onCommented }) {
  const { user, isAdmin } = useAuth()
  const [localComments, setLocalComments] = useState(initialComments)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return

    setSending(true)
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: user.id, text: text.trim() })
      .select('id, post_id, user_id, text, created_at')
      .single()

    if (!error && data) {
      setLocalComments(cs => [...cs, { ...data, user_name: user.user_metadata?.full_name || user.email || 'You' }])
      setText('')
      onCommented?.()
    }
    setSending(false)
  }

  async function handleSaveComment(id) {
    if (!editText.trim()) return
    const { error } = await supabase.from('comments').update({ text: editText.trim() }).eq('id', id)
    if (!error) {
      setLocalComments(cs => cs.map(c => c.id === id ? { ...c, text: editText.trim() } : c))
      setEditingId(null)
    }
  }

  async function handleDeleteComment(id) {
    const { error } = await supabase.from('comments').delete().eq('id', id)
    if (!error) {
      setLocalComments(cs => cs.filter(c => c.id !== id))
    }
  }

  const visibleComments = expanded ? localComments : localComments.slice(0, 2)
  const hasMore = localComments.length > 2 && !expanded

  return (
    <div className="space-y-2.5">
      {localComments.length > 0 && (
        <div className="space-y-1.5">
          {visibleComments.map((c, i) => {
            const canManageComment = c.user_id === user?.id || isAdmin
            return (
              <div
                key={c.id}
                className="group flex gap-1.5 text-sm animate-slide-in-left"
                style={{ animationDelay: `${i * 0.05}s`, opacity: 0 }}
              >
                <span className="font-semibold text-slate-200 shrink-0">{c.user_name}</span>
                {editingId === c.id ? (
                  <>
                    <input
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveComment(c.id)}
                      className="flex-1 bg-white/5 rounded px-2 py-0.5 text-slate-200 border border-white/8 focus:outline-none focus:border-brand-500/50 text-xs"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveComment(c.id)}
                      className="text-xs text-brand-500 hover:text-brand-400 shrink-0 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-slate-500 hover:text-slate-300 shrink-0 transition-colors"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-slate-400 leading-snug flex-1">{c.text}</span>
                    {canManageComment && (
                      <span className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingId(c.id); setEditText(c.text) }}
                          className="text-slate-600 hover:text-slate-300 transition-colors"
                          title="Edit"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="text-slate-600 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </span>
                    )}
                  </>
                )}
              </div>
            )
          })}
          {hasMore && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-slate-600 hover:text-brand-400 transition-colors"
            >
              View all {localComments.length} comments
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 border border-white/5 focus:border-brand-500/50 focus:bg-white/8 focus:outline-none transition-all"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="text-sm font-semibold text-brand-500 disabled:text-slate-700 transition-colors hover:text-brand-400 active:scale-95"
        >
          Post
        </button>
      </form>
    </div>
  )
}
