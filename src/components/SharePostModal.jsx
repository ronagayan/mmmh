import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function SharePostModal({ post, onClose }) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [sent, setSent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (!data) { setLoading(false); return }

    const otherIds = data.map((c) => c.user1_id === user.id ? c.user2_id : c.user1_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', otherIds)

    const pm = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
    setConversations(data.map((c) => ({
      ...c,
      other_user: pm[c.user1_id === user.id ? c.user2_id : c.user1_id] || {},
    })))
    setLoading(false)
  }

  const searchUsers = async (q) => {
    setQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .ilike('display_name', `%${q}%`)
      .neq('id', user.id)
      .limit(5)
    setSearchResults(data || [])
  }

  const getOrCreateConv = async (otherUserId) => {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(user1_id.eq.${user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${user.id})`)
      .limit(1)
    if (existing?.length) return existing[0].id
    const { data } = await supabase
      .from('conversations')
      .insert({ user1_id: user.id, user2_id: otherUserId })
      .select()
      .single()
    return data?.id
  }

  const share = async (convId) => {
    await supabase.from('messages').insert({
      conversation_id: convId,
      sender_id: user.id,
      post_id: post.id,
      text: null,
      encrypted: false,
    })
    setSent(convId)
    setTimeout(onClose, 1200)
  }

  const shareToUser = async (otherUserId) => {
    const convId = await getOrCreateConv(otherUserId)
    if (convId) share(convId)
  }

  const isSearching = query.length >= 2
  const displayed = isSearching ? searchResults : conversations

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto bg-[#0d1525] border border-white/8 rounded-t-2xl p-4 space-y-3 animate-slide-in-up">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-100">Share post</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-2xl leading-none">×</button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => searchUsers(e.target.value)}
          placeholder="Search people…"
          className="w-full bg-white/5 rounded-xl px-4 py-2 text-sm text-slate-200 placeholder-slate-600 border border-white/8 focus:border-brand-500/60 focus:outline-none transition-all"
        />

        <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-hide">
          {loading && <p className="text-sm text-slate-500 text-center py-4">Loading…</p>}
          {!loading && displayed.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">
              {isSearching ? 'No users found' : 'No conversations yet — search for someone above'}
            </p>
          )}
          {displayed.map((item) => {
            const profile = isSearching ? item : item.other_user
            const convId = isSearching ? null : item.id
            const isSent = sent === convId
            return (
              <button
                key={item.id}
                onClick={() => convId ? share(convId) : shareToUser(item.id)}
                disabled={isSent}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all text-left disabled:opacity-60"
              >
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full ring-1 ring-white/10 shrink-0 object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-brand-500/20 flex items-center justify-center font-bold text-brand-400 shrink-0">
                    {profile.display_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <span className="flex-1 text-sm font-medium text-slate-200">{profile.display_name}</span>
                <span className={`text-xs font-semibold transition-colors ${isSent ? 'text-green-400' : 'text-brand-500'}`}>
                  {isSent ? 'Sent ✓' : 'Send'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
