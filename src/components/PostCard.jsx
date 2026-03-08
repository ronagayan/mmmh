import { useState, useEffect, useRef } from 'react'
import RatingSlider from './RatingSlider'
import MemRating from './MemRating'
import Comments from './Comments'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function PostCard({ post, onRated, onCommented, onDeleted, index = 0 }) {
  const { user, isAdmin } = useAuth()
  const [showRating, setShowRating] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editCaption, setEditCaption] = useState(post.caption || '')
  const [saving, setSaving] = useState(false)
  const menuRef = useRef(null)

  const myRating = post.ratings?.find((r) => r.user_id === user?.id)
  const canManage = post.user_id === user?.id || isAdmin

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  async function handleSaveCaption() {
    setSaving(true)
    const { error } = await supabase.from('posts').update({ caption: editCaption }).eq('id', post.id)
    setSaving(false)
    if (!error) {
      post.caption = editCaption
      setEditMode(false)
    }
  }

  async function handleDelete() {
    setMenuOpen(false)
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (!error) onDeleted?.(post.id)
  }

  return (
    <div
      className="bg-slate-900/60 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/5 card-lift opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      {/* Image with zoom */}
      <div className="relative aspect-square bg-slate-800 img-zoom-wrap">
        <img
          src={post.image_url}
          alt={post.caption}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Subtle gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      </div>

      <div className="p-4 space-y-3">
        {/* Author + timestamp + menu */}
        <div className="flex items-center gap-2">
          {post.author_avatar && (
            <img
              src={post.author_avatar}
              alt=""
              className="w-6 h-6 rounded-full ring-1 ring-white/10"
              referrerPolicy="no-referrer"
            />
          )}
          <span className="text-sm font-semibold text-slate-200">{post.author_name}</span>
          <span className="text-xs text-slate-600 ml-auto">
            {new Date(post.created_at).toLocaleDateString()}
          </span>
          {canManage && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors leading-none text-lg"
                aria-label="Post options"
              >
                ···
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-7 z-10 bg-slate-800 border border-white/10 rounded-xl shadow-xl py-1 min-w-[140px]">
                  <button
                    onClick={() => { setEditMode(true); setMenuOpen(false) }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    Edit caption
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 hover:text-red-300 transition-colors"
                  >
                    Delete post
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Caption / edit mode */}
        {editMode ? (
          <div className="space-y-2">
            <textarea
              value={editCaption}
              onChange={e => setEditCaption(e.target.value)}
              className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm text-slate-200 border border-white/8 focus:border-brand-500/50 focus:outline-none resize-none"
              rows={2}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setEditMode(false); setEditCaption(post.caption || '') }}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCaption}
                disabled={saving}
                className="text-xs font-semibold text-brand-500 hover:text-brand-400 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          post.caption && <p className="text-slate-300 leading-snug">{post.caption}</p>
        )}

        {/* Ratings */}
        <MemRating ratings={post.ratings} />

        {/* Rate button / slider */}
        {!showRating ? (
          <button
            onClick={() => setShowRating(true)}
            className="w-full py-2 rounded-xl bg-white/5 text-slate-400 hover:text-brand-400 hover:bg-white/10 transition-all text-sm font-medium active:scale-[0.98] border border-white/5 hover:border-brand-500/25"
          >
            {myRating
              ? `Your rating: ${myRating.rating} מ · Change`
              : 'Rate this מ'}
          </button>
        ) : (
          <div className="animate-scale-in">
            <RatingSlider
              postId={post.id}
              existingRating={myRating?.rating}
              onRated={onRated}
            />
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-white/5" />

        {/* Comments */}
        <Comments
          postId={post.id}
          comments={post.comments || []}
          onCommented={onCommented}
        />
      </div>
    </div>
  )
}
