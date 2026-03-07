import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

async function validateFood(file) {
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    const { data, error } = await supabase.functions.invoke('validate-food', {
      body: { imageBase64: base64, mimeType: file.type },
    })
    if (error) return true
    return data.isFood
  } catch {
    return true
  }
}

// ── Recipe Step Editor ────────────────────────────────────────────────────────
function RecipeEditor({ recipe, onChange }) {
  const addIngredient = () =>
    onChange({ ...recipe, ingredients: [...recipe.ingredients, { name: '', amount: '' }] })

  const updateIngredient = (i, field, val) => {
    const updated = recipe.ingredients.map((ing, idx) =>
      idx === i ? { ...ing, [field]: val } : ing
    )
    onChange({ ...recipe, ingredients: updated })
  }

  const removeIngredient = (i) =>
    onChange({ ...recipe, ingredients: recipe.ingredients.filter((_, idx) => idx !== i) })

  const addStep = () =>
    onChange({ ...recipe, steps: [...recipe.steps, ''] })

  const updateStep = (i, val) => {
    const updated = recipe.steps.map((s, idx) => (idx === i ? val : s))
    onChange({ ...recipe, steps: updated })
  }

  const removeStep = (i) =>
    onChange({ ...recipe, steps: recipe.steps.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Dish name */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 px-1">
          Dish Name
        </label>
        <input
          type="text"
          value={recipe.name}
          onChange={(e) => onChange({ ...recipe, name: e.target.value })}
          placeholder="e.g. Grandma's Pasta Carbonara"
          className="w-full bg-white/5 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 border border-white/8 focus:border-brand-500/60 focus:bg-white/8 focus:outline-none transition-all"
        />
      </div>

      {/* Ingredients */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Ingredients
          </label>
          <span className="text-xs text-slate-600">{recipe.ingredients.length} items</span>
        </div>
        <div className="space-y-2">
          {recipe.ingredients.map((ing, i) => (
            <div
              key={i}
              className="flex gap-2 animate-slide-in-left"
              style={{ animationDelay: `${i * 0.04}s`, animationFillMode: 'both' }}
            >
              <div className="w-7 h-7 mt-1.5 flex-shrink-0 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                <span className="text-xs font-bold text-brand-500">{i + 1}</span>
              </div>
              <input
                type="text"
                value={ing.name}
                onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                placeholder="Ingredient"
                className="flex-1 min-w-0 bg-white/5 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 border border-white/8 focus:border-brand-500/60 focus:outline-none transition-all"
              />
              <input
                type="text"
                value={ing.amount}
                onChange={(e) => updateIngredient(i, 'amount', e.target.value)}
                placeholder="Amount"
                className="w-24 bg-white/5 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 border border-white/8 focus:border-brand-500/60 focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => removeIngredient(i)}
                className="w-8 h-8 mt-1 flex-shrink-0 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-600 hover:text-red-400 flex items-center justify-center transition-all"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addIngredient}
          className="mt-2 w-full py-2 rounded-xl border border-dashed border-white/10 hover:border-brand-500/40 text-slate-600 hover:text-brand-500 text-sm transition-all flex items-center justify-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add ingredient
        </button>
      </div>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Steps
          </label>
          <span className="text-xs text-slate-600">{recipe.steps.length} steps</span>
        </div>
        <div className="space-y-2">
          {recipe.steps.map((step, i) => (
            <div
              key={i}
              className="flex gap-2 animate-slide-in-left"
              style={{ animationDelay: `${i * 0.04}s`, animationFillMode: 'both' }}
            >
              <div className="w-7 h-7 mt-2.5 flex-shrink-0 rounded-full bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
                <span className="text-xs font-bold text-brand-400">{i + 1}</span>
              </div>
              <textarea
                value={step}
                onChange={(e) => updateStep(i, e.target.value)}
                placeholder={`Step ${i + 1}…`}
                rows={2}
                className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 border border-white/8 focus:border-brand-500/60 focus:outline-none resize-none transition-all"
              />
              <button
                type="button"
                onClick={() => removeStep(i)}
                className="w-8 h-8 mt-2 flex-shrink-0 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-600 hover:text-red-400 flex items-center justify-center transition-all"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addStep}
          className="mt-2 w-full py-2 rounded-xl border border-dashed border-white/10 hover:border-brand-500/40 text-slate-600 hover:text-brand-500 text-sm transition-all flex items-center justify-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add step
        </button>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 px-1">
          Notes <span className="text-slate-700 normal-case font-normal">(optional)</span>
        </label>
        <textarea
          value={recipe.notes}
          onChange={(e) => onChange({ ...recipe, notes: e.target.value })}
          placeholder="Tips, substitutions, serving suggestions…"
          rows={2}
          className="w-full bg-white/5 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 border border-white/8 focus:border-brand-500/60 focus:bg-white/8 focus:outline-none resize-none transition-all"
        />
      </div>
    </div>
  )
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
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setFoodError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return

    setValidating(true)
    const isFood = await validateFood(file)
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
