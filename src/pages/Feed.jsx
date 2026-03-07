import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import PostCard from '../components/PostCard'

export default function Feed() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchPosts = useCallback(async () => {
    const { data: postsData } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })

    if (!postsData) {
      setLoading(false)
      return
    }

    // Fetch ratings for all posts
    const postIds = postsData.map((p) => p.id)
    const { data: ratingsData } = await supabase
      .from('ratings')
      .select('*, profiles(display_name)')
      .in('post_id', postIds)

    // Fetch comments for all posts
    const { data: commentsData } = await supabase
      .from('comments')
      .select('*, profiles(display_name)')
      .in('post_id', postIds)
      .order('created_at', { ascending: true })

    // Fetch author profiles
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
        .map((r) => ({
          ...r,
          user_name: r.profiles?.display_name || 'Anonymous',
        })),
      comments: (commentsData || [])
        .filter((c) => c.post_id === post.id)
        .map((c) => ({
          ...c,
          user_name: c.profiles?.display_name || 'Anonymous',
        })),
    }))

    setPosts(enriched)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-2xl animate-pulse text-brand-500 font-bold">Loading...</div>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-6xl mb-4">🍽️</div>
        <h2 className="text-xl font-bold text-slate-300 mb-2">No posts yet</h2>
        <p className="text-slate-500">Be the first to share some food!</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onRated={fetchPosts} onCommented={fetchPosts} />
      ))}
    </div>
  )
}
