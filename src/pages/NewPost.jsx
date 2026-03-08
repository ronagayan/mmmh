import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import RecipeEditor from '../components/RecipeEditor'
import { validateImageFile, MAX_CAPTION_LENGTH } from '../lib/sanitize'

const HF_URL = 'https://api-inference.huggingface.co/models/Kaludi/food-not-food-image-classification'
const MAX_RETRIES = 3
const RETRY_DELAY = 3000 // ms — HuggingFace cold-start takes ~20s, but we poll

async function classifyImage(file) {
  const res = await fetch(HF_URL, { method: 'POST', body: file })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const result = await res.json()

  // Model still loading: {"error": "...", "estimated_time": N}
  if (result?.error && typeof result.estimated_time === 'number') {
    throw new Error('loading')
  }
  if (!Array.isArray(result)) throw new Error('unexpected response')

  // HuggingFace returns [[{label, score}, ...]] for image classification
  const items = Array.isArray(result[0]) ? result[0] : result
  if (!items.length) throw new Error('empty response')

  const food = items.find((r) => r.label?.toLowerCase() === 'food')
  const notFood = items.find((r) => r.label?.toLowerCase().includes('not'))

  if (food) return food.score > 0.5
  if (notFood) return notFood.score < 0.5
  return items[0]?.label?.toLowerCase().includes('food') ?? false
}

async function validateFood(file, onStatus) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await classifyImage(file)
    } catch (err) {
      if (err.message === 'loading' && attempt < MAX_RETRIES - 1) {
        onStatus?.('Model warming up, retrying…')
        await new Promise((r) => setTimeout(r, RETRY_DELAY * (attempt + 1)))
        continue
      }
      // On final failure, block the upload to be safe
      return false
    }
  }
  return false
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function NewPost() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  // Mode: 'photo' | 'recipe'
  const [mode, setMode] = useState('photo')

  // Photo state
  const [caption, setCaption] = useState('')
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [foodError, setFoodError] = useState('')

  // Visibility
  const [visibility, setVisibility] = useState('public')

  // Recipe state
  const [recipe, setRecipe] = useState({
    name: '',
    ingredients: [{ name: '', amount: '' }],
    steps: [''],
    notes: '',
  })

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    const fileErr = validateImageFile(selected)
    if (fileErr) {
      setFoodError(fileErr)
      return
    }
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setFoodError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return

    setValidating(true)
    setFoodError('')
    const isFood = await validateFood(file, (status) => setFoodError(status))
    setValidating(false)

    if (!isFood) {
      setFoodError("That doesn't look like food. Only food photos allowed 🍽️")
      return
    }

    setUploading(true)

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

    // For recipe mode, serialize recipe as structured caption
    const finalCaption = mode === 'recipe' && recipe.name
      ? `__recipe__${JSON.stringify(recipe)}`
      : caption.trim() || null

    const { error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        image_url: publicUrl,
        caption: finalCaption,
        visibility,
      })

    if (postError) {
      alert('Failed to create post')
      setUploading(false)
      return
    }

    navigate('/')
  }

  const recipeValid = mode === 'recipe'
    ? recipe.name.trim() && recipe.steps.some(s => s.trim())
    : true

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in-up pb-6">
      <h2 className="text-xl font-bold text-slate-100">Share some food</h2>

      {/* Mode toggle */}
      <div className="flex rounded-xl bg-white/5 border border-white/8 p-1">
        {[
          { id: 'photo', label: '📸 Photo', sub: 'quick post' },
          { id: 'recipe', label: '📋 Recipe', sub: 'step by step' },
        ].map(({ id, label, sub }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex flex-col items-center gap-0.5 ${
              mode === id
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
            <span className={`text-xs font-normal ${mode === id ? 'text-orange-100/70' : 'text-slate-700'}`}>{sub}</span>
          </button>
        ))}
      </div>

      {/* Visibility picker */}
      <div className="flex gap-2">
        {[
          { id: 'public', label: '🌍 Public', sub: 'everyone' },
          { id: 'followers', label: '🔒 Followers', sub: 'only' },
        ].map(({ id, label, sub }) => (
          <button
            key={id}
            type="button"
            onClick={() => setVisibility(id)}
            className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-all duration-200 flex flex-col items-center gap-0.5 ${
              visibility === id
                ? 'bg-brand-500/15 border-brand-500/50 text-brand-400'
                : 'bg-white/3 border-white/8 text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
            <span className={`text-xs font-normal ${visibility === id ? 'text-brand-400/70' : 'text-slate-700'}`}>{sub}</span>
          </button>
        ))}
      </div>

      {/* ── Photo picker ─────────────────────────────────────── */}
      <div>
        {preview ? (
          <div
            className="relative aspect-square rounded-2xl overflow-hidden ring-2 ring-brand-500/60 ring-offset-2 ring-offset-[#080d18] cursor-pointer"
            onClick={() => galleryInputRef.current?.click()}
          >
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-all flex items-center justify-center">
              <span className="opacity-0 hover:opacity-100 transition-opacity text-white text-sm font-semibold bg-black/60 px-3 py-1.5 rounded-xl">
                Change photo
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
            {/* Placeholder area */}
            <div className="aspect-square flex flex-col items-center justify-center gap-3 text-slate-600">
              <div className="text-5xl opacity-20">🍽️</div>
              <p className="text-sm">Add a photo of your {mode === 'recipe' ? 'dish' : 'food'}</p>
            </div>
          </div>
        )}

        {/* Camera / Upload split buttons */}
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-slate-300 text-sm font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Camera
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-slate-300 text-sm font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Gallery
          </button>
        </div>

        {/* Hidden inputs */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
        <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </div>

      {/* ── Recipe editor or caption ─────────────────────────── */}
      {mode === 'recipe' ? (
        <RecipeEditor recipe={recipe} onChange={setRecipe} />
      ) : (
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="What is this dish?"
          rows={2}
          maxLength={MAX_CAPTION_LENGTH}
          className="w-full bg-white/5 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 border border-white/8 focus:border-brand-500/60 focus:bg-white/8 focus:outline-none resize-none transition-all"
        />
      )}

      {foodError && (
        <p className="text-red-400 text-sm px-1 animate-fade-in">{foodError}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!file || uploading || validating || !recipeValid}
        className="w-full py-3 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-lg shadow-brand-500/20"
      >
        {validating ? 'Checking…' : uploading ? 'Posting…' : mode === 'recipe' ? '🍳 Share Recipe' : '📸 Share'}
      </button>
    </form>
  )
}
