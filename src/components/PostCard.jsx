import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import RatingSlider from './RatingSlider'
import MemRating from './MemRating'
import Comments from './Comments'
import RecipeEditor from './RecipeEditor'
import SharePostModal from './SharePostModal'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { supabase } from '../lib/supabase'

const RECIPE_PREFIX = '__recipe__'

function RecipeCard({ raw }) {
  let recipe
  try { recipe = JSON.parse(raw) } catch { return <p className="text-slate-300 leading-snug">{RECIPE_PREFIX}{raw}</p> }

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-3 space-y-3 text-sm">
      {recipe.name && (
        <p className="font-semibold text-slate-100 text-base">🍳 {recipe.name}</p>
      )}
      {recipe.ingredients?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Ingredients</p>
          <ul className="space-y-1">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex justify-between text-slate-300">
                <span>{ing.name}</span>
                {ing.amount && <span className="text-slate-500">{ing.amount}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {recipe.steps?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Steps</p>
          <ol className="space-y-1.5">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-slate-300">
                <span className="shrink-0 w-5 h-5 rounded-full bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-xs font-bold text-brand-400">{i + 1}</span>
                <span className="leading-snug">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {recipe.notes && (
        <p className="text-slate-500 text-xs italic border-t border-white/5 pt-2">{recipe.notes}</p>
      )}
    </div>
  )
}

export default function PostCard({ post, onRated, onCommented, onDeleted, index = 0 }) {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { lang } = usePrefs()
  const mem = lang === 'he' ? 'מ' : 'm'
  const isRecipePost = post.caption?.startsWith(RECIPE_PREFIX)
  const [showRating, setShowRating] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editCaption, setEditCaption] = useState(post.caption || '')
  const [recipeEditData, setRecipeEditData] = useState(() => {
    if (!post.caption?.startsWith(RECIPE_PREFIX)) return null
    try { return JSON.parse(post.caption.slice(RECIPE_PREFIX.length)) } catch { return null }
  })
  const [saving, setSaving] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
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
    const newCaption = isRecipePost && recipeEditData
      ? `${RECIPE_PREFIX}${JSON.stringify(recipeEditData)}`
      : editCaption
    const { error } = await supabase.from('posts').update({ caption: newCaption }).eq('id', post.id)
    setSaving(false)
    if (!error) {
      post.caption = newCaption
      setEditMode(false)
    }
  }

  async function handleDelete() {
    setMenuOpen(false)
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (!error) onDeleted?.(post.id)
  }

  return (
    <>
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
          <button
            onClick={() => navigate(post.user_id === user?.id ? '/profile' : `/u/${post.user_id}`)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            {post.author_avatar && (
              <img
                src={post.author_avatar}
                alt=""
                className="w-6 h-6 rounded-full ring-1 ring-white/10"
                referrerPolicy="no-referrer"
              />
            )}
            <span className="text-sm font-semibold text-slate-200">{post.author_name}</span>
          </button>
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
            {isRecipePost && recipeEditData ? (
              <RecipeEditor recipe={recipeEditData} onChange={setRecipeEditData} />
            ) : (
              <textarea
                value={editCaption}
                onChange={e => setEditCaption(e.target.value)}
                className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm text-slate-200 border border-white/8 focus:border-brand-500/50 focus:outline-none resize-none"
                rows={2}
                autoFocus
              />
            )}
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
        ) : post.caption ? (
          post.caption.startsWith(RECIPE_PREFIX)
            ? <RecipeCard raw={post.caption.slice(RECIPE_PREFIX.length)} />
            : <p className="text-slate-300 leading-snug">{post.caption}</p>
        ) : null}

        {/* Ratings */}
        <MemRating ratings={post.ratings} />

        {/* Rate button / slider */}
        {!showRating ? (
          <button
            onClick={() => setShowRating(true)}
            className="w-full py-2 rounded-xl bg-white/5 text-slate-400 hover:text-brand-400 hover:bg-white/10 transition-all text-sm font-medium active:scale-[0.98] border border-white/5 hover:border-brand-500/25"
          >
            {myRating
              ? `Your rating: ${myRating.rating} ${mem} · Change`
              : `Rate this ${mem}`}
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

        {/* Divider + share */}
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-white/5" />
          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-400 transition-colors py-0.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
        </div>

        {/* Comments */}
        <Comments
          postId={post.id}
          comments={post.comments || []}
          onCommented={onCommented}
        />
      </div>
    </div>

    {shareOpen && <SharePostModal post={post} onClose={() => setShareOpen(false)} />}
  </>
  )
}
