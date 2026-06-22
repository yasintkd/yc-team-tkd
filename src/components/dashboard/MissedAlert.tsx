import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'

type MissedAthlete = {
  id: string
  name: string
  groupName: string
  missedCount: number
  lastDate: string | null
}

export default function MissedAlert({ athletes }: { athletes: MissedAthlete[] }) {
  const navigate = useNavigate()
  if (athletes.length === 0) return null

  return (
    <section>
      <div className="glass-panel rounded-2xl border-l-4 border-l-amber-400 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {athletes.length} sporcu üst üste 4+ antrenmana katılmadı
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Son kayıtlara göre bu sporcular son 4 veya daha fazla antrenmana gelmemiş.
            </p>
            <ul className="mt-3 space-y-1.5">
              {athletes.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs cursor-pointer hover:bg-amber-100/60 transition"
                  onClick={() => navigate(`/sporcular/${m.id}`)}
                >
                  <span className="font-medium text-slate-800">{m.name}</span>
                  <span className="text-brand-muted">
                    {m.groupName} · {m.missedCount} kez
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}