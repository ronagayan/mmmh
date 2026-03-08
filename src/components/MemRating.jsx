export default function MemRating({ ratings }) {
  if (!ratings || ratings.length === 0) return null

  const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0)
  const avgRating = totalRating / ratings.length
  const netCount = Math.max(0, totalRating)
  const netText = 'מ'.repeat(netCount)

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
      {/* Net מ display */}
      <div
        className="text-2xl leading-relaxed tracking-wider break-all font-medium animate-fade-in"
        dir="rtl"
        style={{ opacity: 0 }}
      >
        {netCount > 0 ? (
          <span className="text-brand-400">{netText}</span>
        ) : (
          <span className="text-red-400">🤮{'מ'.repeat(Math.abs(totalRating))}</span>
        )}
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
