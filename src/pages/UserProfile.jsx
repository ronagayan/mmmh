import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PostCard from '../components/PostCard'
import FollowButton from '../components/FollowButton'

export default function UserProfile() {
  const { userId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId === user?.id) {
      navigate('/profile', { replace: true })
      return
    }
    load()
  }, [userId])

  const load = async () => {
    setLoading(true)
    const [profileRes, followerRes, followingRes, postsRes] = await Promise.all([
      supabase.from('profiles').select('id, display_name, avatar_url').eq('id', userId).single(),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
      supabase.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ])

    const prof = profileRes.data
    setProfile(prof)
    setFollowerCount(followerRes.count ?? 0)
    setFollowingCount(followingRes.count ?? 0)

    const postsData = postsRes.data || []
    const postIds = postsData.map((p) => p.id)

    const [ratingsRes, commentsRes] = await Promise.all([
      postIds.length
        ? supabase.from('ratings').select('*, profiles(display_name)').in('post_id', postIds)
        : Promise.resolve({ data: [] }),
      postIds.length
        ? supabase.from('comments').select('id, post_id, user_id, text, created_at, profiles(display_name)').in('post_id', postIds).order('created_at', { ascending: true })
        : Promise.resolve({ data: [] }),
    ])

    const enriched = postsData.map((post) => ({
      ...post,
      author_name: prof?.display_name || 'Anonymous',
      author_avatar: prof?.avatar_url || '',
      ratings: (ratingsRes.data || [])
        .filter((r) => r.post_id === post.id)
        .map((r) => ({ ...r, user_name: r.profiles?.display_name || 'Anonymous' })),
      comments: (commentsRes.data || [])
        .filter((c) => c.post_id === post.id)
        .map((c) => ({ id: c.id, post_id: c.post_id, user_id: c.user_id, text: c.text, created_at: c.created_at, user_name: c.profiles?.display_name || 'Anonymous' })),
    }))

    setPosts(enriched)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="flex gap-1" dir="rtl">
          {['מ', 'מ', 'מ'].map((char, i) => (
            <span key={i} className="text-4xl font-bold text-brand-500 inline-block animate-bounce-dot" style={{ animationDelay: `${i * 0.18}s` }}>{char}</span>
          ))}
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center py-24 text-slate-500 animate-fade-in">
        <div className="text-5xl mb-4">🤷</div>
        <p className="font-semibold text-slate-400">User not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in-up pb-4">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors -ml-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Profile header */}
      <div className="flex items-center gap-4">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="w-16 h-16 rounded-full ring-2 ring-brand-500/30 object-cover shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-16 h-16 rounded-full ring-2 ring-brand-500/30 bg-brand-500/20 flex items-center justify-center text-2xl font-bold text-brand-400 shrink-0">
            {profile.display_name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-slate-100 truncate">{profile.display_name}</h2>
          <div className="flex gap-4 mt-1.5 text-sm text-slate-500 flex-wrap">
            <span><span className="font-semibold text-slate-300">{posts.length}</span> posts</span>
            <span><span className="font-semibold text-slate-300">{followerCount}</span> followers</span>
            <span><span className="font-semibold text-slate-300">{followingCount}</span> following</span>
          </div>
        </div>
        <FollowButton userId={userId} />
      </div>

      <div className="border-t border-white/5" />

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-16 text-slate-500 animate-fade-in">
          <div className="text-5xl mb-4 animate-float">🍽️</div>
          <p>No posts yet</p>
        </div>
      ) : (
        <div className="space-y-5">
          {posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              index={i}
              onRated={load}
              onCommented={load}
              onDeleted={(id) => setPosts((ps) => ps.filter((p) => p.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
