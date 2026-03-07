import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Conversation() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [otherUser, setOtherUser] = useState(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    fetchConversation()

    const channel = supabase
      .channel(`messages:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const fetchConversation = async () => {
    const { data: conv } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single()

    if (!conv) {
      navigate('/messages')
      return
    }

    const otherId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('id', otherId)
      .single()

    setOtherUser(profile)

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    setMessages(msgs || [])
    setLoading(false)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!text.trim()) return

    setSending(true)
    await supabase
      .from('messages')
      .insert({ conversation_id: id, sender_id: user.id, text: text.trim() })

    setText('')
    setSending(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-2xl animate-pulse text-brand-500 font-bold">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Chat header */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
        <button
          onClick={() => navigate('/messages')}
          className="text-slate-400 hover:text-slate-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {otherUser && (
          <>
            <img
              src={otherUser.avatar_url}
              alt=""
              className="w-8 h-8 rounded-full"
              referrerPolicy="no-referrer"
            />
            <span className="font-medium text-slate-200">{otherUser.display_name}</span>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-2">
        {messages.map((msg) => {
          const isMine = msg.sender_id === user.id
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                  isMine
                    ? 'bg-brand-500 text-white rounded-br-md'
                    : 'bg-slate-700 text-slate-200 rounded-bl-md'
                }`}
              >
                {msg.text}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2 pt-3 border-t border-slate-800">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 border border-slate-700 focus:border-brand-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium disabled:opacity-50 transition-all active:scale-95"
        >
          Send
        </button>
      </form>
    </div>
  )
}
