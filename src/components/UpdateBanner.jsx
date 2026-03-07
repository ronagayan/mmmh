import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdateBanner() {
  const {
    needRefresh:        [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-[4.5rem] inset-x-3 z-[60] animate-slide-in-up pointer-events-auto">
      <div className="bg-[#111c35] border border-brand-500/25 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl shadow-black/50">
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/20 flex items-center justify-center shrink-0 text-lg">
          🆕
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">Update available</p>
          <p className="text-xs text-slate-500 mt-0.5">Reload to get the latest version</p>
        </div>

        {/* Reload */}
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="shrink-0 px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all active:scale-95 shadow-md shadow-brand-500/25"
        >
          Reload
        </button>

        {/* Dismiss */}
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="shrink-0 w-7 h-7 rounded-full bg-white/8 hover:bg-white/15 text-slate-500 hover:text-slate-300 flex items-center justify-center text-base transition-all"
        >
          ×
        </button>
      </div>
    </div>
  )
}
