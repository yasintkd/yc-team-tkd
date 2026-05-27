import { Bell, Search } from 'lucide-react'

export default function Topbar() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Akademi Kontrol Paneli
          </h1>
          <p className="text-xs text-slate-400">
            Sporcuları, ödemeleri ve yoklamayı tek yerden yönet.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 md:flex">
            <Search className="h-3.5 w-3.5" />
            <input
              placeholder="Sporcu, veli, branş ara..."
              className="w-40 bg-transparent outline-none placeholder:text-slate-500"
            />
          </div>
          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-semibold text-slate-950">
              3
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}
