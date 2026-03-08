import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
  } = useRegisterSW({
    // Check for updates every 60 seconds so long sessions don't miss deploys
    onRegisteredSW(_swUrl, sw) {
      setInterval(() => sw.update(), 60_000)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-[4.5rem] inset-x-3 z-[60] animate-slide-in-up pointer-events-none">
      <div className="bg-[#111c35] border border-brand-500/25 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl shadow-black/50">
        <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/20 flex items-center justify-center shrink-0 text-lg">
          🆕
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">Updating…</p>
          <p className="text-xs text-slate-500 mt-0.5">New version installing, hang on</p>
        </div>
      </div>
    </div>
  )
}
