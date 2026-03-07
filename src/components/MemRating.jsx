export default function MemRating({ ratings }) {
  if (!ratings || ratings.length === 0) return null

  const segments = ratings.map((r) => {
    const absVal = Math.abs(r.rating)
    const mems = 'מ'.repeat(absVal)
    return {
      text: mems,
      negative: r.rating < 0,
      rating: r.rating,
      userName: r.user_name,
    }
  })

  const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0)
  const avgRating = totalRating / ratings.length

  const avgColor =
    avgRating < 0
      ? '#f87171'
      : avgRating <= 3
      ? '#fb923c'
      : avgRating <= 6
      ? '#facc15'
      : '#4ade80'

  return (
    <div className="space-y-1.5">
      {/* The merged מ display */}
      <div
        className="text-2xl leading-relaxed tracking-wider break-all font-medium"
        dir="rtl"
      >
        {segments.map((seg, i) => (
          <span
            key={i}
            className={`inline-block animate-fade-in ${
              seg.negative ? 'text-red-400 line-through' : 'text-brand-400'
            }`}
            style={{ animationDelay: `${i * 0.07}s`, opacity: 0 }}
            title={`${seg.userName}: ${seg.rating} מ`}
          >
            {seg.text}
          </span>
        ))}
      </div>

      {/* Summary */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>{ratings.length} rating{ratings.length !== 1 && 's'}</span>
        <span className="text-slate-700">·</span>
        <span>avg</span>
        <span className="font-semibold" style={{ color: avgColor }}>
          {avgRating.toFixed(1)} מ
        </span>
      </div>
    </div>
  )
}
