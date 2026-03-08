import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PostCard from '../components/PostCard'

export default function Feed() {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedMode, setFeedMode] = useState('forYou')

  const fetchPosts = useCallback(async () => {
    setLoading(true)

    let query = supabase.from('posts').select('*').order('created_at', { ascending: false })

    if (feedMode === 'following' && user) {
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)

      const ids = (follows || []).map((f) => f.following_id)
      if (ids.length === 0) {
        setPosts([])
        setLoading(false)
        return
      }
      query = query.in('user_id', ids)
    }

    const { data: postsData } = await query
    if (!postsData) { setLoading(false); return }

    const postIds = postsData.map((p) => p.id)
    const { data: ratingsData } = await supabase
      .from('ratings')
      .select('*, profiles(display_name)')
      .in('post_id', postIds)

    const { data: commentsData } = await supabase
      .from('comments')
      .select('id, post_id, user_id, text, created_at, profiles(display_name)')
      .in('post_id', postIds)
      .order('created_at', { ascending: true })

    const authorIds = [...new Set(postsData.map((p) => p.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', authorIds)

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]))

    const enriched = postsData.map((post) => ({
      ...post,
      author_name: profileMap[post.user_id]?.display_name || 'Anonymous',
      author_avatar: profileMap[post.user_id]?.avatar_url || '',
      ratings: (ratingsData || [])
        .filter((r) => r.post_id === post.id)
        .map((r) => ({ ...r, user_name: r.profiles?.display_name || 'Anonymous' })),
      comments: (commentsData || [])
        .filter((c) => c.post_id === post.id)
        .map((c) => ({
          id: c.id,
          post_id: c.post_id,
          user_id: c.user_id,
          text: c.text,
          created_at: c.created_at,
          user_name: c.profiles?.display_name || 'Anonymous',
        })),
    }))

    setPosts(enriched)
    setLoading(false)
  }, [feedMode, user])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const tabs = [
    { id: 'forYou', label: 'For You' },
    { id: 'following', label: 'Following' },
  ]

  return (
    <div className="space-y-4 pb-4">
      {/* Feed tabs */}
      <div className="flex rounded-xl bg-white/5 border border-white/8 p-1">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFeedMode(id)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              feedMode === id
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
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
          <p className="text-slate-600 text-sm animate-fade-in" style={{ animationDelay: '0.3s', opacity: 0 }}>
            Loading the goods…
          </p>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in-up">
          <div className="text-6xl mb-5 animate-float">
            {feedMode === 'following' ? '👤' : '🍽️'}
          </div>
          <h2 className="text-xl font-bold text-slate-300 mb-2">
            {feedMode === 'following' ? 'Nothing here yet' : 'No posts yet'}
          </h2>
          <p className="text-slate-500">
            {feedMode === 'following'
              ? 'Follow some people to see their posts here'
              : 'Be the first to share some food!'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              index={i}
              onRated={fetchPosts}
              onCommented={fetchPosts}
              onDeleted={(id) => setPosts(ps => ps.filter(p => p.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
