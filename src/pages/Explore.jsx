import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import FollowButton from '../components/FollowButton'
import { escapeIlike } from '../lib/sanitize'

export default function Explore() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .neq('id', user.id)
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }) => setSuggestions(data || []))
  }, [])

  const search = async (q) => {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .ilike('display_name', `%${escapeIlike(q)}%`)
      .neq('id', user.id)
      .limit(20)
    setResults(data || [])
    setSearching(false)
  }

  const displayed = query.length >= 2 ? results : suggestions

  return (
    <div className="space-y-4 animate-fade-in-up pb-4">
      <h2 className="text-xl font-bold text-slate-100">Explore</h2>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search people…"
          className="w-full bg-white/5 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 border border-white/8 focus:border-brand-500/60 focus:outline-none transition-all"
        />
      </div>

      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
        {query.length >= 2
          ? (searching ? 'Searching…' : `${results.length} result${results.length !== 1 ? 's' : ''}`)
          : 'People you may know'}
      </p>

      <div className="space-y-2">
        {displayed.map((profile) => (
          <div
            key={profile.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5 hover:bg-white/5 transition-all animate-fade-in-up"
          >
            <button
              onClick={() => navigate(`/u/${profile.id}`)}
              className="flex items-center gap-3 flex-1 min-w-0 text-left"
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full ring-1 ring-white/10 object-cover shrink-0" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center text-lg font-bold text-brand-400 shrink-0">
                  {profile.display_name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <span className="font-semibold text-slate-200 truncate">{profile.display_name}</span>
            </button>
            <FollowButton userId={profile.id} size="sm" />
          </div>
        ))}

        {displayed.length === 0 && !searching && (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-3">🔍</div>
            <p>{query.length >= 2 ? 'No users found' : 'No other users yet'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
