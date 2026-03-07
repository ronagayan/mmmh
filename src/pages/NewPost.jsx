import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function NewPost() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [caption, setCaption] = useState('')
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return

    setUploading(true)

    // Upload image to Supabase Storage
    const ext = file.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('food-images')
      .upload(fileName, file)

    if (uploadError) {
      alert('Failed to upload image')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('food-images')
      .getPublicUrl(fileName)

    // Create post
    const { error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        image_url: publicUrl,
        caption: caption.trim() || null,
      })

    if (postError) {
      alert('Failed to create post')
      setUploading(false)
      return
    }

    navigate('/')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in-up">
      <h2 className="text-xl font-bold text-slate-100">Share some food</h2>

      {/* Image picker */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className={`relative aspect-square rounded-2xl cursor-pointer transition-all duration-200 overflow-hidden ${
          preview
            ? 'ring-2 ring-brand-500/60 ring-offset-2 ring-offset-[#080d18]'
            : 'border-2 border-dashed border-white/10 hover:border-brand-500/40 bg-white/3 hover:bg-white/5'
        }`}
      >
        {preview ? (
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-400 font-medium">Tap to add a photo</p>
              <p className="text-xs text-slate-600 mt-0.5">or take one with your camera</p>
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Caption */}
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="What is this dish?"
        rows={2}
        className="w-full bg-white/5 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 border border-white/8 focus:border-brand-500/60 focus:bg-white/8 focus:outline-none resize-none transition-all"
      />

      {/* Submit */}
      <button
        type="submit"
        disabled={!file || uploading}
        className="w-full py-3 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-lg shadow-brand-500/20"
      >
        {uploading ? 'Posting…' : 'Share'}
      </button>
    </form>
  )
}
