import { useState } from 'react'
import RatingSlider from './RatingSlider'
import MemRating from './MemRating'
import Comments from './Comments'
import { useAuth } from '../context/AuthContext'

export default function PostCard({ post, onRated, onCommented, index = 0 }) {
  const { user } = useAuth()
  const [showRating, setShowRating] = useState(false)

  const myRating = post.ratings?.find((r) => r.user_id === user.id)

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
        {/* Author + timestamp */}
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
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="text-slate-300 leading-snug">{post.caption}</p>
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
