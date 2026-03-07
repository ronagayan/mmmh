import { useState } from 'react'
import RatingSlider from './RatingSlider'
import MemRating from './MemRating'
import Comments from './Comments'
import { useAuth } from '../context/AuthContext'

export default function PostCard({ post, onRated, onCommented }) {
  const { user } = useAuth()
  const [showRating, setShowRating] = useState(false)

  const myRating = post.ratings?.find((r) => r.user_id === user.id)

  return (
    <div className="bg-slate-800 rounded-2xl overflow-hidden shadow-lg">
      {/* Image */}
      <div className="relative aspect-square bg-slate-700">
        <img
          src={post.image_url}
          alt={post.caption}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      <div className="p-4 space-y-3">
        {/* Author + timestamp */}
        <div className="flex items-center gap-2">
          <img
            src={post.author_avatar}
            alt=""
            className="w-6 h-6 rounded-full"
            referrerPolicy="no-referrer"
          />
          <span className="text-sm font-medium text-slate-300">{post.author_name}</span>
          <span className="text-xs text-slate-600 ml-auto">
            {new Date(post.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="text-slate-200">{post.caption}</p>
        )}

        {/* Merged מ ratings */}
        <MemRating ratings={post.ratings} />

        {/* Rate button / slider */}
        {!showRating ? (
          <button
            onClick={() => setShowRating(true)}
            className="w-full py-2 rounded-xl bg-slate-700/50 text-slate-400 hover:text-brand-400 hover:bg-slate-700 transition-all text-sm font-medium"
          >
            {myRating ? `Your rating: ${myRating.rating} מ · Change` : 'Rate this מ'}
          </button>
        ) : (
          <RatingSlider
            postId={post.id}
            existingRating={myRating?.rating}
            onRated={onRated}
          />
        )}

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
