import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { escapeIlike } from '../lib/sanitize'

export default function Messages() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    fetchConversations()
  }, [])

  const fetchConversations = async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (!data) {
      setLoading(false)
      return
    }

    const otherUserIds = data.map((c) =>
      c.user1_id === user.id ? c.user2_id : c.user1_id
    )

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', otherUserIds)

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]))

    // Get last message for each conversation
    const enriched = await Promise.all(
      data.map(async (conv) => {
        const otherId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('text, post_id, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)

        return {
          ...conv,
          other_user: profileMap[otherId] || { display_name: 'Unknown', avatar_url: '' },
          last_message: lastMsg?.[0] || null,
        }
      })
    )

    setConversations(enriched)
    setLoading(false)
  }

  const searchUsers = async (query) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .ilike('display_name', `%${escapeIlike(query)}%`)
      .neq('id', user.id)
      .limit(5)

    setSearchResults(data || [])
    setSearching(false)
  }

  const startConversation = async (otherUserId) => {
    // Check if conversation already exists
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(user1_id.eq.${user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${user.id})`
      )
      .limit(1)

    if (existing && existing.length > 0) {
      navigate(`/chat/${existing[0].id}`)
      return
    }

    const { data, error } = await supabase
      .from('conversations')
      .insert({ user1_id: user.id, user2_id: otherUserId })
      .select()
      .single()

    if (!error && data) {
      navigate(`/chat/${data.id}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-2xl animate-pulse text-brand-500 font-bold">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-200">Messages</h2>

      {/* Search users */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => searchUsers(e.target.value)}
          placeholder="Search people..."
          className="w-full bg-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 border border-slate-700 focus:border-brand-500 focus:outline-none"
        />
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden z-10">
            {searchResults.map((profile) => (
              <button
                key={profile.id}
                onClick={() => {
                  startConversation(profile.id)
                  setSearchQuery('')
                  setSearchResults([])
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-left"
              >
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="w-8 h-8 rounded-full"
                  referrerPolicy="no-referrer"
                />
                <span className="text-sm text-slate-200">{profile.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conversations list */}
      {conversations.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <div className="text-4xl mb-3">💬</div>
          <p>No conversations yet</p>
          <p className="text-sm mt-1">Search for someone to start chatting</p>
        </div>
      ) : (
        <div className="space-y-1">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => navigate(`/chat/${conv.id}`)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 transition-colors text-left"
            >
              <img
                src={conv.other_user.avatar_url}
                alt=""
                className="w-10 h-10 rounded-full"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-200">
                  {conv.other_user.display_name}
                </div>
                {conv.last_message && (
                  <div className="text-xs text-slate-500 truncate">
                    {conv.last_message.post_id ? '📎 Shared a post' : conv.last_message.text}
                  </div>
                )}
              </div>
              {conv.last_message && (
                <span className="text-xs text-slate-600 shrink-0">
                  {new Date(conv.last_message.created_at).toLocaleDateString()}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
