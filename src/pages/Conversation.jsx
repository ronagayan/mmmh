import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  getOrCreateKeyPair,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
} from '../lib/crypto'

async function tryDecrypt(sharedKey, msg) {
  if (!msg.encrypted || !sharedKey) return { ...msg, display: msg.text }
  try {
    return { ...msg, display: await decryptMessage(sharedKey, msg.text) }
  } catch {
    return { ...msg, display: '🔒 Encrypted on another device' }
  }
}

export default function Conversation() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [messages, setMessages] = useState([])
  const [otherUser, setOtherUser] = useState(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [e2eReady, setE2eReady] = useState(false)

  // Ref so the realtime callback always sees the current shared key
  const sharedKeyRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    initConversation()

    const channel = supabase
      .channel(`messages:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        async (payload) => {
          const msg = await tryDecrypt(sharedKeyRef.current, payload.new)
          setMessages((prev) => [...prev, msg])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        },
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const initConversation = async () => {
    const { data: conv } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single()

    if (!conv) { navigate('/messages'); return }

    const otherId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, public_key')
      .eq('id', otherId)
      .single()

    setOtherUser(profile)

    // Derive E2E shared key if the other user has published their public key
    let sk = null
    if (profile?.public_key) {
      try {
        const keyPair = await getOrCreateKeyPair()
        sk = await deriveSharedKey(keyPair.privateKey, profile.public_key)
        sharedKeyRef.current = sk
        setE2eReady(true)
      } catch {
        // Non-fatal — fall back to unencrypted
      }
    }

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    const decrypted = await Promise.all((msgs || []).map((m) => tryDecrypt(sk, m)))
    setMessages(decrypted)
    setLoading(false)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)

    const sk = sharedKeyRef.current
    const payload = sk
      ? { text: await encryptMessage(sk, text.trim()), encrypted: true }
      : { text: text.trim(), encrypted: false }

    await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: user.id,
      ...payload,
    })

    setText('')
    setSending(false)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="flex gap-1" dir="rtl">
          {['מ', 'מ', 'מ'].map((char, i) => (
            <span
              key={i}
              className="text-4xl font-bold text-brand-500 inline-block animate-bounce-dot"
              style={{ animationDelay: `${i * 0.18}s` }}
            >
              {char}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-white/5">
        <button
          onClick={() => navigate('/messages')}
          className="text-slate-500 hover:text-slate-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {otherUser?.avatar_url && (
          <img
            src={otherUser.avatar_url}
            alt=""
            className="w-8 h-8 rounded-full ring-1 ring-white/10"
            referrerPolicy="no-referrer"
          />
        )}
        <span className="font-semibold text-slate-200 flex-1">{otherUser?.display_name}</span>
        <span
          title={
            e2eReady
              ? 'End-to-end encrypted'
              : 'Not yet encrypted — the other user needs to open the app once to publish their key'
          }
          className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 select-none ${
            e2eReady
              ? 'bg-green-500/15 text-green-400 border border-green-500/25'
              : 'bg-white/5 text-slate-600 border border-white/8'
          }`}
        >
          {e2eReady ? '🔒 Encrypted' : '🔓 Not encrypted'}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1.5 scrollbar-hide">
        {messages.length === 0 && (
          <p className="text-center text-slate-600 text-sm mt-8 animate-fade-in">Say hi 👋</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === user.id
          const isUndecryptable = msg.display === '🔒 Encrypted on another device'
          return (
            <div
              key={msg.id}
              className={`flex animate-fade-in ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-snug ${
                  isMine
                    ? 'bg-brand-500 text-white rounded-br-md shadow-lg shadow-brand-500/20'
                    : 'bg-white/8 text-slate-200 rounded-bl-md border border-white/5'
                } ${isUndecryptable ? 'italic opacity-40' : ''}`}
              >
                {msg.display}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2 pt-3 border-t border-white/5">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={e2eReady ? 'Message (encrypted)…' : 'Type a message…'}
          className="flex-1 bg-white/5 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 border border-white/8 focus:border-brand-500/50 focus:outline-none transition-all"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold disabled:opacity-40 transition-all active:scale-95 shadow-lg shadow-brand-500/20"
        >
          Send
        </button>
      </form>
    </div>
  )
}
