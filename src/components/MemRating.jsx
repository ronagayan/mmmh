export default function MemRating({ ratings }) {
  if (!ratings || ratings.length === 0) return null

  // Build one long string of מ for all ratings merged together
  // Positive ratings = regular מ, negative = styled differently
  const segments = ratings.map((r) => {
    const absVal = Math.abs(r.rating)
    const mems = 'מ'.repeat(absVal)

    if (r.rating < 0) {
      return { text: mems, negative: true, rating: r.rating, userName: r.user_name }
    }
    return { text: mems, negative: false, rating: r.rating, userName: r.user_name }
  })

  const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0)
  const avgRating = totalRating / ratings.length

  return (
    <div className="space-y-2">
      {/* The merged מ display */}
      <div className="text-2xl leading-relaxed tracking-wider break-all font-medium" dir="rtl">
        {segments.map((seg, i) => (
          <span
            key={i}
            className={seg.negative ? 'text-red-400 line-through' : 'text-brand-400'}
            title={`${seg.userName}: ${seg.rating} מ`}
          >
            {seg.text}
          </span>
        ))}
      </div>

      {/* Summary line */}
      <div className="text-xs text-slate-500">
        {ratings.length} rating{ratings.length !== 1 && 's'} · avg {avgRating.toFixed(1)} מ
      </div>
    </div>
  )
}
