export default function RecipeEditor({ recipe, onChange }) {
  const addIngredient = () =>
    onChange({ ...recipe, ingredients: [...recipe.ingredients, { name: '', amount: '' }] })

  const updateIngredient = (i, field, val) =>
    onChange({ ...recipe, ingredients: recipe.ingredients.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing) })

  const removeIngredient = (i) =>
    onChange({ ...recipe, ingredients: recipe.ingredients.filter((_, idx) => idx !== i) })

  const addStep = () =>
    onChange({ ...recipe, steps: [...recipe.steps, ''] })

  const updateStep = (i, val) =>
    onChange({ ...recipe, steps: recipe.steps.map((s, idx) => idx === i ? val : s) })

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
            <div key={i} className="flex gap-2 animate-slide-in-left" style={{ animationDelay: `${i * 0.04}s`, animationFillMode: 'both' }}>
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
            <div key={i} className="flex gap-2 animate-slide-in-left" style={{ animationDelay: `${i * 0.04}s`, animationFillMode: 'both' }}>
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
