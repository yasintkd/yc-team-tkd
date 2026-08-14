import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Play,
  Pause,
  RotateCcw,
  Copy,
  Hand,
  Trophy,
  AlertTriangle,
  X,
  Users,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

// ─── Types ──────────────────────────────────────────────

type AthleteMini = {
  id: string
  first_name: string
  last_name: string
  belt: string
  branch: string
}

type Side = 1 | 2

type Stats = {
  punch: number
  straightBody: number
  straightHead: number
  turnBody: number
  turnHead: number
  gamjeom: number
}

type MatchState = {
  matchId: string
  startedAt: number
  // athletes
  athlete1: AthleteMini | null
  athlete2: AthleteMini | null
  // scores & stats (per side)
  score: Record<Side, number>
  stats: Record<Side, Stats>
  // rounds
  roundWins: Record<Side, number>
  currentRound: number
  // round-end flag per round (side: number | null)
  roundWinners: Record<number, Side | 'draw' | 'ref'>
  // timer
  roundDurationSec: number
  breakDurationSec: number
  timerSec: number
  timerRunning: boolean
  phase: 'idle' | 'round' | 'break' | 'finished'
  // match meta
  winner: Side | null
  refereeWinner: Side | null
}

const DEFAULT_ROUND = 120
const DEFAULT_BREAK = 30

const emptyStats = (): Stats => ({
  punch: 0,
  straightBody: 0,
  straightHead: 0,
  turnBody: 0,
  turnHead: 0,
  gamjeom: 0,
})

const initialState = (matchId: string): MatchState => ({
  matchId,
  startedAt: Date.now(),
  athlete1: null,
  athlete2: null,
  score: { 1: 0, 2: 0 },
  stats: { 1: emptyStats(), 2: emptyStats() },
  roundWins: { 1: 0, 2: 0 },
  currentRound: 1,
  roundWinners: {},
  roundDurationSec: DEFAULT_ROUND,
  breakDurationSec: DEFAULT_BREAK,
  timerSec: DEFAULT_ROUND,
  timerRunning: false,
  phase: 'idle',
  winner: null,
  refereeWinner: null,
})

// ─── Tie-breaker (spec §5.4, birebir) ───────────────────

function getWinner(s1: number, s2: number, st1: Stats, st2: Stats): Side | null {
  if (s1 !== s2) return s1 > s2 ? 1 : 2
  if (st1.turnHead !== st2.turnHead) return st1.turnHead > st2.turnHead ? 1 : 2
  if (st1.turnBody !== st2.turnBody) return st1.turnBody > st2.turnBody ? 1 : 2
  if (st1.straightHead !== st2.straightHead) return st1.straightHead > st2.straightHead ? 1 : 2
  if (st1.straightBody !== st2.straightBody) return st1.straightBody > st2.straightBody ? 1 : 2
  if (st1.gamjeom !== st2.gamjeom) return st1.gamjeom < st2.gamjeom ? 1 : 2
  return null
}

// ─── Realtime ───────────────────────────────────────────

const BROADCAST_NAME = 'state'

export default function LiveScore() {
  const { status, user } = useAuth()
  const [params, setParams] = useSearchParams()
  const urlMatchId = params.get('matchId') || ''

  // Admin = authenticated user (logged in)
  const isAuthAdmin = status === 'authenticated' && !!user

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return isAuthAdmin || sessionStorage.getItem('liveScore:admin') === '1'
  })

  // matchId: önce URL, yoksa yeni UUID
  const [matchId, setMatchId] = useState<string>(() => {
    if (urlMatchId) return urlMatchId
    return crypto.randomUUID()
  })

  // URL ile geldiyse → misafir modu, kendi state'i başlatma
  const isGuestByUrl = !!urlMatchId

  // Sync isAdmin with auth status
  useEffect(() => {
    if (isAuthAdmin) setIsAdmin(true)
  }, [isAuthAdmin])

  const [state, setState] = useState<MatchState>(() => initialState(matchId))
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const [athletes, setAthletes] = useState<AthleteMini[]>([])
  const [refereeOpen, setRefereeOpen] = useState(false)
  const [roundEndConfirmOpen, setRoundEndConfirmOpen] = useState(false)
  const [pendingRoundWinner, setPendingRoundWinner] = useState<Side | null>(null)

  // ── Sporcuları çek
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('athletes')
        .select('id, first_name, last_name, belt, branch')
        .eq('is_active', true)
        .order('first_name')
      setAthletes((data ?? []) as AthleteMini[])
    })()
  }, [])

  // ── Realtime channel
  useEffect(() => {
    if (!matchId) return
    const ch = supabase.channel(`match:${matchId}`, {
      config: { broadcast: { self: false }, presence: { key: matchId } },
    })
    ch.on('broadcast', { event: BROADCAST_NAME }, ({ payload }) => {
      if (payload && typeof payload === 'object') {
        setState(payload as MatchState)
      }
    })
    ch.subscribe()
    channelRef.current = ch
    return () => {
      void supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [matchId])

  // ── Admin olarak URL'e matchId yaz
  useEffect(() => {
    if (!isGuestByUrl && matchId) {
      setParams({ matchId }, { replace: true })
    }
  }, [matchId, isGuestByUrl, setParams])

  // ── Broadcast (admin only)
  const broadcast = (next: MatchState) => {
    setState(next)
    if (!isAdmin) return
    const ch = channelRef.current
    if (ch) void ch.send({ type: 'broadcast', event: BROADCAST_NAME, payload: next })
  }

  // ── Timer
  useEffect(() => {
    if (!isAdmin) return
    if (!state.timerRunning) return
    const id = setInterval(() => {
      setState((prev) => {
        if (!prev.timerRunning) return prev
        const nextSec = prev.timerSec - 1
        if (nextSec > 0) return { ...prev, timerSec: nextSec }
        // süre bitti
        if (prev.phase === 'round') {
          return { ...prev, timerSec: 0, timerRunning: false }
        }
        if (prev.phase === 'break') {
          return { ...prev, timerSec: prev.roundDurationSec, timerRunning: false, phase: 'round' }
        }
        return prev
      })
    }, 1000)
    return () => clearInterval(id)
  }, [state.timerRunning, state.phase, isAdmin])

  // ── Süre 0'a inince otomatik raunt bitir kontrolü (admin)
  useEffect(() => {
    if (!isAdmin) return
    if (state.phase !== 'round') return
    if (state.timerRunning) return
    if (state.timerSec !== 0) return
    // otomatik raunt sonu
    handleRoundEnd()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.timerRunning, state.timerSec])

  // ── Helpers
  const canControl = isAdmin && state.athlete1 && state.athlete2

  const setScore = (side: Side, delta: number, statKey?: keyof Stats) => {
    if (!isAdmin) return
    setState((prev) => {
      const next: MatchState = {
        ...prev,
        score: { ...prev.score, [side]: prev.score[side] + delta },
        stats: {
          ...prev.stats,
          [side]: { ...prev.stats[side], ...(statKey ? { [statKey]: prev.stats[side][statKey] + 1 } : {}) },
        },
      }
      broadcast(next)
      return next
    })
  }

  const addGamJeom = (penalized: Side) => {
    if (!isAdmin) return
    setState((prev) => {
      const opp: Side = penalized === 1 ? 2 : 1
      const penalizedStats = { ...prev.stats[penalized], gamjeom: prev.stats[penalized].gamjeom + 1 }
      // 5. cezada otomatik raunt kaybı
      const autoRoundLoss = penalizedStats.gamjeom >= 5
      const next: MatchState = {
        ...prev,
        score: { ...prev.score, [opp]: prev.score[opp] + 1 },
        stats: { ...prev.stats, [penalized]: penalizedStats },
      }
      if (autoRoundLoss) {
        // anında raunt sonucu işle
        return finalizeRound(next, opp)
      }
      broadcast(next)
      return next
    })
  }

  const finalizeRound = (s: MatchState, winner: Side | null): MatchState => {
    const updated: MatchState = { ...s, timerRunning: false }
    if (winner) {
      updated.roundWins = { ...updated.roundWins, [winner]: updated.roundWins[winner] + 1 }
      updated.roundWinners = { ...updated.roundWinners, [updated.currentRound]: winner }
    } else {
      updated.roundWinners = { ...updated.roundWinners, [updated.currentRound]: 'draw' }
    }
    // Best of 3 → 2 kazanan bitti
    if (updated.roundWins[1] >= 2 || updated.roundWins[2] >= 2) {
      updated.phase = 'finished'
      updated.winner = updated.roundWins[1] >= 2 ? 1 : 2
      updated.timerSec = 0
      return updated
    }
    // sonraki raunt → araya geç
    updated.phase = 'break'
    updated.timerSec = updated.breakDurationSec
    updated.currentRound = updated.currentRound + 1
    return updated
  }

  const handleRoundEnd = () => {
    if (!isAdmin) return
    const w = getWinner(
      state.score[1],
      state.score[2],
      state.stats[1],
      state.stats[2],
    )
    if (w === null) {
      // hakem kararı gerekli
      setPendingRoundWinner(null)
      setRefereeOpen(true)
      return
    }
    setPendingRoundWinner(w)
    setRoundEndConfirmOpen(true)
  }

  const confirmRoundEnd = (winner: Side) => {
    setRoundEndConfirmOpen(false)
    setState((prev) => {
      const next = finalizeRound(prev, winner)
      broadcast(next)
      return next
    })
  }

  const confirmRefereeWinner = (side: Side) => {
    setRefereeOpen(false)
    setState((prev) => {
      const next = finalizeRound(prev, side)
      next.refereeWinner = side
      broadcast(next)
      return next
    })
  }

  const setRoundDuration = (v: number) => {
    if (!isAdmin) return
    setState((prev) => ({ ...prev, roundDurationSec: v, timerSec: v }))
  }
  const setBreakDuration = (v: number) => {
    if (!isAdmin) return
    setState((prev) => ({ ...prev, breakDurationSec: v }))
  }

  const startMatch = () => {
    if (!isAdmin) return
    if (!state.athlete1 || !state.athlete2) return
    const next: MatchState = {
      ...state,
      phase: 'round',
      timerRunning: true,
      timerSec: state.roundDurationSec,
      currentRound: 1,
    }
    broadcast(next)
  }

  const pauseToggle = () => {
    if (!isAdmin) return
    setState((prev) => {
      const next = { ...prev, timerRunning: !prev.timerRunning }
      broadcast(next)
      return next
    })
  }

  const resetMatch = () => {
    if (!isAdmin) return
    if (!confirm('Maçı sıfırla? Tüm puan ve istatistikler silinir.')) return
    const fresh = initialState(matchId)
    fresh.roundDurationSec = state.roundDurationSec
    fresh.breakDurationSec = state.breakDurationSec
    broadcast(fresh)
  }

  const newMatch = () => {
    if (!isAdmin) return
    const id = crypto.randomUUID()
    setMatchId(id)
    const fresh = initialState(id)
    fresh.roundDurationSec = state.roundDurationSec
    fresh.breakDurationSec = state.breakDurationSec
    setState(fresh)
    setParams({ matchId: id }, { replace: true })
  }

  const promoteToAdmin = () => {
    sessionStorage.setItem('liveScore:admin', '1')
    setIsAdmin(true)
  }

  const copyInvite = async () => {
    const url = `${window.location.origin}/canli-skor?matchId=${matchId}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
  }

  const setAthlete = (side: Side, a: AthleteMini | null) => {
    if (!isAdmin) return
    setState((prev) => {
      const next = { ...prev, [side === 1 ? 'athlete1' : 'athlete2']: a }
      broadcast(next)
      return next
    })
  }

  // ── UI ─────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="glass-panel flex flex-col gap-2 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Canlı Skor</h1>
          <p className="text-xs text-brand-muted">
            {isAdmin ? 'Admin' : 'Misafir (Scorekeeper)'} • Maç ID: <code className="font-mono">{matchId.slice(0, 8)}</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button onClick={copyInvite} className="btn-primary flex items-center gap-1.5 text-xs">
              <Copy className="h-3.5 w-3.5" /> Davet Linki
            </button>
          )}
          {isAdmin && (
            <button onClick={newMatch} className="rounded-lg border border-app-border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-app-bg-soft">
              Yeni Maç
            </button>
          )}
          {!isAdmin && !isGuestByUrl && (
            <button onClick={promoteToAdmin} className="rounded-lg border border-app-border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-app-bg-soft">
              Admin Ol
            </button>
          )}
        </div>
      </div>

      {/* Sporcu seçimi (admin) */}
      {isAdmin && (
        <div className="glass-panel grid gap-3 rounded-2xl p-4 sm:grid-cols-2">
          <AthleteSelect
            label="Sporcu 1 (Mavi)"
            color="blue"
            athletes={athletes}
            value={state.athlete1}
            onChange={(a) => setAthlete(1, a)}
            disabled={state.phase !== 'idle' && state.phase !== 'finished'}
          />
          <AthleteSelect
            label="Sporcu 2 (Kırmızı)"
            color="red"
            athletes={athletes}
            value={state.athlete2}
            onChange={(a) => setAthlete(2, a)}
            disabled={state.phase !== 'idle' && state.phase !== 'finished'}
          />
        </div>
      )}

      {/* Misafir: sporcuları göster */}
      {!isAdmin && (state.athlete1 || state.athlete2) && (
        <div className="glass-panel grid gap-2 rounded-2xl p-4 sm:grid-cols-2">
          <SideHeader color="blue" athlete={state.athlete1} score={state.score[1]} stats={state.stats[1]} />
          <SideHeader color="red" athlete={state.athlete2} score={state.score[2]} stats={state.stats[2]} />
        </div>
      )}

      {/* Skor board */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Mavi */}
        <ScoreBoard
          color="blue"
          athlete={state.athlete1}
          score={state.score[1]}
          stats={state.stats[1]}
          isAdmin={isAdmin}
          disabled={!canControl || state.phase !== 'round'}
          onScore={(delta, key) => setScore(1, delta, key)}
          onGamJeom={() => addGamJeom(1)}
          roundWins={state.roundWins[1]}
        />
        {/* Orta: round / timer */}
        <CenterPanel
          state={state}
          isAdmin={isAdmin}
          onStart={startMatch}
          onPause={pauseToggle}
          onReset={resetMatch}
          onEndRound={handleRoundEnd}
          onSetRoundDuration={setRoundDuration}
          onSetBreakDuration={setBreakDuration}
          canStart={isAdmin && !!state.athlete1 && !!state.athlete2 && state.phase === 'idle'}
          canPause={isAdmin && state.phase !== 'finished'}
          canEnd={isAdmin && state.phase === 'round'}
        />
        {/* Kırmızı */}
        <ScoreBoard
          color="red"
          athlete={state.athlete2}
          score={state.score[2]}
          stats={state.stats[2]}
          isAdmin={isAdmin}
          disabled={!canControl || state.phase !== 'round'}
          onScore={(delta, key) => setScore(2, delta, key)}
          onGamJeom={() => addGamJeom(2)}
          roundWins={state.roundWins[2]}
        />
      </div>

      {/* Round history */}
      <div className="glass-panel rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-slate-800">Raunt Geçmişi</h3>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          {[1, 2, 3].map((r) => {
            const w = state.roundWinners[r]
            return (
              <div key={r} className="rounded-lg border border-app-border bg-white p-2">
                <div className="text-brand-muted">Raunt {r}</div>
                <div className="mt-1 font-semibold text-slate-800">
                  {w === undefined ? '—' : w === 'draw' ? 'Berabere' : w === 'ref' ? 'Hakem' : w === 1 ? (state.athlete1?.first_name ?? 'Mavi') : (state.athlete2?.first_name ?? 'Kırmızı')}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Hakem popup (raunt sonu beraberlik) */}
      {refereeOpen && (
        <Modal onClose={() => setRefereeOpen(false)} title="Hakem Kararı (Beraberlik)">
          <p className="text-sm text-slate-600">
            Tüm kriterler eşit. Rauntun galibini manuel seçin.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => confirmRefereeWinner(1)}
              className="rounded-xl border-2 border-blue-500 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Mavi Kazandı
            </button>
            <button
              onClick={() => confirmRefereeWinner(2)}
              className="rounded-xl border-2 border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              Kırmızı Kazandı
            </button>
          </div>
        </Modal>
      )}

      {/* Raunt sonu onay */}
      {roundEndConfirmOpen && (
        <Modal onClose={() => setRoundEndConfirmOpen(false)} title="Raunt Sonu Onayı">
          <p className="text-sm text-slate-600">
            Bu rauntun galibi: <strong>{pendingRoundWinner === 1 ? 'Mavi' : 'Kırmızı'}</strong>. Onaylıyor musunuz?
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setRoundEndConfirmOpen(false)}
              className="rounded-lg border border-app-border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-app-bg-soft"
            >
              İptal
            </button>
            <button onClick={() => confirmRoundEnd(pendingRoundWinner!)} className="btn-primary">
              Onayla
            </button>
          </div>
        </Modal>
      )}

      {/* Maç bitti banner */}
      {state.phase === 'finished' && state.winner && (
        <div className="glass-panel flex items-center justify-between rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-emerald-700">
                Maç Bitti — Kazanan: {state.winner === 1 ? (state.athlete1?.first_name ?? 'Mavi') : (state.athlete2?.first_name ?? 'Kırmızı')}
              </p>
              {state.refereeWinner && (
                <p className="text-xs text-emerald-600">(Hakem kararı ile)</p>
              )}
            </div>
          </div>
          {isAdmin && (
            <button onClick={newMatch} className="btn-primary text-xs">
              Yeni Maç
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────

function AthleteSelect({
  label,
  color,
  athletes,
  value,
  onChange,
  disabled,
}: {
  label: string
  color: 'blue' | 'red'
  athletes: AthleteMini[]
  value: AthleteMini | null
  onChange: (a: AthleteMini | null) => void
  disabled?: boolean
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return athletes.slice(0, 50)
    return athletes
      .filter((a) =>
        `${a.first_name} ${a.last_name} ${a.belt} ${a.branch}`.toLowerCase().includes(s),
      )
      .slice(0, 50)
  }, [q, athletes])

  const accent = color === 'blue' ? 'border-blue-400 focus:border-blue-500' : 'border-red-400 focus:border-red-500'

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-700">{label}</label>
      {value ? (
        <div className={`flex items-center justify-between rounded-lg border ${accent} bg-white px-3 py-2`}>
          <div>
            <div className="text-sm font-semibold text-slate-800">{value.first_name} {value.last_name}</div>
            <div className="text-[10px] text-brand-muted">{value.belt} • {value.branch}</div>
          </div>
          {!disabled && (
            <button onClick={() => onChange(null)} className="text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder="Sporcu ara..."
            disabled={disabled}
            className={`input-field ${accent}`}
          />
          {open && !disabled && (
            <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-app-border bg-white shadow-lg">
              {filtered.length === 0 ? (
                <div className="p-3 text-xs text-brand-muted">Sonuç yok</div>
              ) : (
                filtered.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      onChange(a)
                      setOpen(false)
                      setQ('')
                    }}
                    className="block w-full px-3 py-2 text-left text-xs hover:bg-app-bg-soft"
                  >
                    <div className="font-medium text-slate-800">{a.first_name} {a.last_name}</div>
                    <div className="text-[10px] text-brand-muted">{a.belt} • {a.branch}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SideHeader({ color, athlete, score, stats }: { color: 'blue' | 'red'; athlete: AthleteMini | null; score: number; stats: Stats }) {
  const accent = color === 'blue' ? 'text-blue-700' : 'text-red-700'
  return (
    <div className={`rounded-xl border border-app-border bg-white p-3`}>
      <div className={`text-xs font-semibold ${accent}`}>
        {color === 'blue' ? 'Mavi (Sporcu 1)' : 'Kırmızı (Sporcu 2)'}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-800">
        {athlete ? `${athlete.first_name} ${athlete.last_name}` : '— seçilmedi —'}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-800">{score}</span>
        <span className="text-[10px] text-brand-muted">puan</span>
      </div>
      <div className="mt-1 text-[10px] text-brand-muted">
        Gam-Jeom: {stats.gamjeom} / 5
      </div>
    </div>
  )
}

function ScoreBoard({
  color,
  athlete,
  score,
  stats,
  isAdmin,
  disabled,
  onScore,
  onGamJeom,
  roundWins,
}: {
  color: 'blue' | 'red'
  athlete: AthleteMini | null
  score: number
  stats: Stats
  isAdmin: boolean
  disabled: boolean
  onScore: (delta: number, statKey?: keyof Stats) => void
  onGamJeom: () => void
  roundWins: number
}) {
  const isBlue = color === 'blue'
  const headerBg = isBlue ? 'bg-blue-600' : 'bg-red-600'
  const ringColor = isBlue ? 'focus:ring-blue-300' : 'focus:ring-red-300'

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div className={`${headerBg} px-4 py-3 text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider opacity-80">{isBlue ? 'Mavi' : 'Kırmızı'} (Sporcu {isBlue ? '1' : '2'})</p>
            <p className="text-sm font-semibold">{athlete ? `${athlete.first_name} ${athlete.last_name}` : '— seçilmedi —'}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold leading-none">{score}</p>
            <p className="mt-1 text-[10px] opacity-80">{roundWins} raunt</p>
          </div>
        </div>
      </div>

      <div className="space-y-2 p-3">
        {[
          { d: 6, k: 'turnHead' as const, label: 'Kafaya Dönerli (+6)' },
          { d: 4, k: 'turnBody' as const, label: 'Gövdeye Dönerli (+4)' },
          { d: 3, k: 'straightHead' as const, label: 'Kafaya Düz (+3)' },
          { d: 2, k: 'straightBody' as const, label: 'Gövdeye Düz (+2)' },
          { d: 1, k: 'punch' as const, label: 'Yumruk (+1)' },
        ].map(({ d, k, label }) => (
          <button
            key={k}
            disabled={disabled || !isAdmin}
            onClick={() => onScore(d, k)}
            className={`flex w-full items-center justify-between rounded-lg border border-app-border bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition active:scale-[0.98] hover:bg-app-bg-soft disabled:cursor-not-allowed disabled:opacity-50 ${ringColor}`}
          >
            <span className="flex items-center gap-2">
              <Hand className="h-3.5 w-3.5 text-brand-muted" />
              {label}
            </span>
            <span className={`font-bold ${isBlue ? 'text-blue-600' : 'text-red-600'}`}>+{d}</span>
          </button>
        ))}

        {/* Gam-Jeom */}
        <button
          disabled={disabled || !isAdmin || stats.gamjeom >= 5}
          onClick={onGamJeom}
          className={`flex w-full items-center justify-between rounded-lg border-2 ${
            isBlue ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-red-200 bg-red-50 text-red-700'
          } px-3 py-2.5 text-sm font-semibold transition active:scale-[0.98] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            Gam-Jeom (Ceza)
          </span>
          <span className="font-bold">{stats.gamjeom} / 5</span>
        </button>
      </div>
    </div>
  )
}

function CenterPanel({
  state,
  isAdmin,
  onStart,
  onPause,
  onReset,
  onEndRound,
  onSetRoundDuration,
  onSetBreakDuration,
  canStart,
  canPause,
  canEnd,
}: {
  state: MatchState
  isAdmin: boolean
  onStart: () => void
  onPause: () => void
  onReset: () => void
  onEndRound: () => void
  onSetRoundDuration: (v: number) => void
  onSetBreakDuration: (v: number) => void
  canStart: boolean
  canPause: boolean
  canEnd: boolean
}) {
  const mm = String(Math.floor(state.timerSec / 60)).padStart(2, '0')
  const ss = String(state.timerSec % 60).padStart(2, '0')

  const phaseLabel =
    state.phase === 'idle' ? 'Hazır' :
    state.phase === 'round' ? 'Raunt' :
    state.phase === 'break' ? 'Ara' : 'Bitti'

  return (
    <div className="glass-panel flex flex-col rounded-2xl p-4">
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
          {phaseLabel} • Raunt {Math.min(state.currentRound, 3)} / 3
        </p>
        <p className={`mt-2 font-mono text-5xl font-bold ${state.timerSec === 0 && state.phase === 'round' ? 'text-red-600' : 'text-slate-800'}`}>
          {mm}:{ss}
        </p>
        <p className="mt-1 text-xs text-brand-muted">
          Raunt Kazanma: <strong className="text-blue-600">{state.roundWins[1]}</strong> – <strong className="text-red-600">{state.roundWins[2]}</strong>
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>Süre (sn)</span>
          <input
            type="number"
            min={10}
            max={600}
            value={state.roundDurationSec}
            disabled={!isAdmin || state.phase !== 'idle'}
            onChange={(e) => {
              const v = Math.max(10, Math.min(600, Number(e.target.value) || 0))
              onSetRoundDuration(v)
            }}
            className="input-field h-8 w-20 text-center text-xs"
          />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>Ara (sn)</span>
          <input
            type="number"
            min={5}
            max={300}
            value={state.breakDurationSec}
            disabled={!isAdmin || state.phase !== 'idle'}
            onChange={(e) => {
              const v = Math.max(5, Math.min(300, Number(e.target.value) || 0))
              onSetBreakDuration(v)
            }}
            className="input-field h-8 w-20 text-center text-xs"
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {state.phase === 'idle' ? (
          <button
            onClick={onStart}
            disabled={!canStart}
            className="col-span-2 btn-primary flex items-center justify-center gap-1.5"
          >
            <Play className="h-4 w-4" /> Maçı Başlat
          </button>
        ) : state.phase === 'finished' ? (
          <button
            disabled
            className="col-span-2 rounded-lg bg-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600"
          >
            Maç Bitti
          </button>
        ) : (
          <>
            <button
              onClick={onPause}
              disabled={!canPause}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-cyan px-3 py-2.5 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
            >
              {state.timerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {state.timerRunning ? 'Duraklat' : 'Devam'}
            </button>
            <button
              onClick={onEndRound}
              disabled={!canEnd}
              className="rounded-lg border border-app-border bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-app-bg-soft disabled:opacity-50"
            >
              Raunt Bitir
            </button>
          </>
        )}
        <button
          onClick={onReset}
          disabled={!isAdmin}
          className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-app-border bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-app-bg-soft disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Sıfırla
        </button>
      </div>

      {!isAdmin && (
        <div className="mt-3 flex items-center justify-center gap-1 text-[10px] text-brand-muted">
          <Users className="h-3 w-3" /> Misafir modu — sadece puan/gam-jeom
        </div>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="glass-panel w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}