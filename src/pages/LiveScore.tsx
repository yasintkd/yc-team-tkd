import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Play,
  Pause,
  RotateCcw,
  Trophy,
  AlertTriangle,
  X,
  QrCode,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import QRCode from 'qrcode'

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

type RefVote = {
  refId: number
  side: Side
  delta: number
  statKey: keyof Stats | 'gamjeom'
  ts: number
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
  // referee consensus (1-3 hakem)
  refCount: number
  pendingVotes: RefVote[]
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
  refCount: 1,
  pendingVotes: [],
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
  const urlRef = parseInt(params.get('ref') || '0', 10)

  // Admin = authenticated user (logged in)
  const isAuthAdmin = status === 'authenticated' && !!user

  // Ref mode: ?ref=1/2/3 ile gelen hakem
  const isReferee = urlRef >= 1 && urlRef <= 3

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
  const [inviteQr, setInviteQr] = useState<string>('')
  const [showInvite, setShowInvite] = useState(false)

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
    // Hakem oyları için ayrı event
    ch.on('broadcast', { event: 'vote' }, ({ payload }) => {
      if (payload && typeof payload === 'object') {
        handleIncomingVote(payload as RefVote)
      }
    })
    // Presence: yeni client katıldığında admin mevcut state'i broadcast eder
    ch.on('presence', { event: 'join' }, ({ newPresences }) => {
      // Sadece admin yanıt verir, ve kendi join'i değil
      if (!isAdmin) return
      const joined = newPresences.find((p: any) => p.user_id !== user?.id)
      if (joined) {
        // Mevcut state'i yeni katılan için broadcast et
        const ch2 = channelRef.current
        if (ch2 && stateRef.current) {
          void ch2.send({ type: 'broadcast', event: BROADCAST_NAME, payload: stateRef.current })
        }
      }
    })
    // Kendi presence'ini tanımla
    ch.on('presence', { event: 'sync' }, () => {
      ch.presenceState()
      // console.log('presence sync', state)
    })
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Presence'e gir
        await ch.track({ user_id: user?.id || 'guest', role: isAdmin ? 'admin' : isReferee ? 'referee' : 'guest', ref: urlRef })
      }
    })
    channelRef.current = ch
    return () => {
      void supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [matchId, isAdmin, isReferee, urlRef, user?.id])

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
  // biome-ignore lint/correctness/useExhaustiveDependencies: suppress unused warning
  void setRoundDuration
  // biome-ignore lint/correctness/useExhaustiveDependencies: suppress unused warning
  void setBreakDuration

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

  // ── Referee consensus helpers ──────────────────────────

  const broadcastVote = (vote: RefVote) => {
    const ch = channelRef.current
    if (ch) void ch.send({ type: 'broadcast', event: 'vote', payload: vote })
  }

  const handleIncomingVote = (vote: RefVote) => {
    // Sadece admin işler
    if (!isAdmin) return
    setState((prev) => {
      // Aynı hakem aynı puan için tekrar oy vermesin
      const already = prev.pendingVotes.find(
        (v) => v.refId === vote.refId && v.side === vote.side && v.delta === vote.delta && v.statKey === vote.statKey,
      )
      if (already) return prev

      const nextVotes = [...prev.pendingVotes, vote]

      // Consensus kontrolü
      const matching = nextVotes.filter(
        (v) => v.side === vote.side && v.delta === vote.delta && v.statKey === vote.statKey,
      )

      // Zaman penceresi: 3 saniye içinde gelmiş olmalı
      const now = Date.now()
      const recent = matching.filter((v) => now - v.ts <= 3000)

      if (recent.length >= prev.refCount) {
        // Consensus sağlandı → puanı uygula, oyları temizle
        const applied: MatchState = {
          ...prev,
          score: { ...prev.score, [vote.side]: prev.score[vote.side] + vote.delta },
          stats: {
            ...prev.stats,
            [vote.side]: {
              ...prev.stats[vote.side],
              ...(vote.statKey !== 'gamjeom'
                ? { [vote.statKey]: prev.stats[vote.side][vote.statKey] + 1 }
                : { gamjeom: prev.stats[vote.side].gamjeom + 1 }),
            },
          },
          pendingVotes: prev.pendingVotes.filter(
            (v) => !(v.side === vote.side && v.delta === vote.delta && v.statKey === vote.statKey),
          ),
        }
        // 5. gam-jeom → auto round loss
        if (vote.statKey === 'gamjeom' && applied.stats[vote.side].gamjeom >= 5) {
          return finalizeRound(applied, vote.side === 1 ? 2 : 1)
        }
        broadcast(applied)
        return applied
      }

      return { ...prev, pendingVotes: nextVotes }
    })
  }

  // ── Hakem butonu handler (ref mode) ────────────────────

  const handleRefButton = (side: Side, delta: number, statKey: keyof Stats | 'gamjeom') => {
    if (!isReferee) return
    const vote: RefVote = {
      refId: urlRef,
      side,
      delta,
      statKey,
      ts: Date.now(),
    }
    broadcastVote(vote)
  }

  // ── RefereeScoreButtons component (hakem UI) ───────────

  function RefereeScoreButtons({
    isReferee,
    side,
    disabled,
    onScore,
    onGamJeom,
  }: {
    isReferee: boolean
    side: Side
    disabled: boolean
    onScore: (side: Side, delta: number, statKey: keyof Stats | 'gamjeom') => void
    onGamJeom: (side: Side) => void
  }) {
    const buttons = [
      { d: 6, k: 'turnHead' as const, label: '+6' },
      { d: 4, k: 'turnBody' as const, label: '+4' },
      { d: 3, k: 'straightHead' as const, label: '+3' },
      { d: 2, k: 'straightBody' as const, label: '+2' },
      { d: 1, k: 'punch' as const, label: '+1' },
    ]

    return (
      <>
        {buttons.map(({ d, k, label }) => (
          <button
            key={k}
            disabled={disabled || !isReferee}
            onClick={() => onScore(side, d, k)}
            className={`flex flex-1 items-center justify-center rounded-xl border-2 ${
              side === 1 ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700' : 'bg-red-600 text-white border-red-700 hover:bg-red-700'
            } py-3 text-2xl font-black shadow active:scale-95 disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {label}
          </button>
        ))}
        <button
          disabled={disabled || !isReferee}
          onClick={() => onGamJeom(side)}
          className={`flex items-center justify-center gap-1 rounded-xl border-2 bg-amber-500 text-white border-amber-600 hover:bg-amber-600 py-2 text-xs font-bold shadow active:scale-95 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> GJ
        </button>
      </>
    )
  }

  // ── UI (tam ekran) ─────────────────────────────────────

  const mm = String(Math.floor(state.timerSec / 60)).padStart(2, '0')
  const ss = String(state.timerSec % 60).padStart(2, '0')
  const phaseLabel =
    state.phase === 'idle' ? 'Hazır' :
    state.phase === 'round' ? 'Raunt' :
    state.phase === 'break' ? 'Ara' : 'Bitti'

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top bar - kompakt */}
      <div className="flex items-center justify-between gap-2 border-b border-app-border bg-white/60 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2 text-xs text-brand-muted">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{matchId.slice(0, 6)}</span>
          <span>{isAdmin ? 'Admin' : 'Misafir'}</span>
        </div>
        <div className="flex gap-1.5">
          {isAdmin && (
            <>
              <button
                onClick={async () => {
                  const url = `${window.location.origin}/canli-skor?matchId=${matchId}`
                  try {
                    const qr = await QRCode.toDataURL(url, { width: 200, margin: 2 })
                    setInviteQr(qr)
                    setShowInvite(true)
                  } catch (e) { console.error(e) }
                }}
                className="flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-white"
              >
                <QrCode className="h-3 w-3" /> QR
              </button>
              <button onClick={newMatch} className="rounded-md border border-app-border bg-white px-2 py-1 text-[11px] font-medium text-slate-700">
                Yeni
              </button>
            </>
          )}
          {!isAdmin && !isGuestByUrl && (
            <button onClick={promoteToAdmin} className="rounded-md border border-app-border bg-white px-2 py-1 text-[11px] font-medium text-slate-700">
              Admin Ol
            </button>
          )}
        </div>
      </div>

      {/* Üst kart - skor + süre */}
      <div className="grid grid-cols-3 gap-1.5 px-2 pt-2">
        <div className="rounded-2xl bg-blue-600 px-3 py-3 text-center text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Mavi</p>
          <p className="mt-0.5 truncate text-xs font-semibold opacity-90">
            {state.athlete1 ? `${state.athlete1.first_name}` : '—'}
          </p>
          <p className="mt-1 text-6xl font-extrabold leading-none drop-shadow-lg">{state.score[1]}</p>
          <p className="mt-1 text-sm font-bold opacity-90">R{state.roundWins[1]} • GJ {state.stats[1].gamjeom}/5</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-800 px-2 py-3 text-center text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
            {phaseLabel} • R{Math.min(state.currentRound, 3)}/3
          </p>
          <p className={`mt-1 font-mono text-5xl font-black leading-none ${
            state.timerSec <= 10 && state.phase === 'round' && state.timerRunning ? 'text-red-400' : 'text-white'
          }`}>
            {mm}:{ss}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-200">
            <span className="text-blue-300">{state.roundWins[1]}</span> – <span className="text-red-300">{state.roundWins[2]}</span>
          </p>
        </div>
        <div className="rounded-2xl bg-red-600 px-3 py-3 text-center text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Kırmızı</p>
          <p className="mt-0.5 truncate text-xs font-semibold opacity-90">
            {state.athlete2 ? `${state.athlete2.first_name}` : '—'}
          </p>
          <p className="mt-1 text-6xl font-extrabold leading-none drop-shadow-lg">{state.score[2]}</p>
          <p className="mt-1 text-sm font-bold opacity-90">R{state.roundWins[2]} • GJ {state.stats[2].gamjeom}/5</p>
        </div>
      </div>

      {/* Sporcu seçimi + Hakem sayısı (admin idle durumda) */}
      {isAdmin && (state.phase === 'idle' || state.phase === 'finished') && (
        <div className="mx-2 mt-2 grid gap-2 sm:grid-cols-3">
          <AthleteSelect
            label="Mavi Sporcu"
            color="blue"
            athletes={athletes}
            value={state.athlete1}
            onChange={(a) => setAthlete(1, a)}
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-700">Hakem Sayısı</label>
            <select
              value={state.refCount}
              onChange={(e) => {
                const v = Math.max(1, Math.min(3, parseInt(e.target.value, 10)))
                setState((prev) => ({ ...prev, refCount: v }))
              }}
              className="input-field text-sm"
            >
              <option value={1}>1 Hakem (Tek)</option>
              <option value={2}>2 Hakem (İkili)</option>
              <option value={3}>3 Hakem (Üçlü)</option>
            </select>
          </div>
          <AthleteSelect
            label="Kırmızı Sporcu"
            color="red"
            athletes={athletes}
            value={state.athlete2}
            onChange={(a) => setAthlete(2, a)}
          />
        </div>
      )}

      {/* Hakem UI (ref mode) */}
      {isReferee && state.phase === 'round' && (
        <div className="flex-1 min-h-0 px-2 py-2">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex flex-col gap-1.5 rounded-2xl bg-blue-50 p-2">
              <p className="text-center text-[10px] font-bold uppercase tracking-wider text-blue-700">
                Mavi (Hakem #{urlRef})
              </p>
              <RefereeScoreButtons
                isReferee={isReferee}
                side={1}
                disabled={state.phase !== 'round'}
                onScore={handleRefButton}
                onGamJeom={(s) => handleRefButton(s, 1, 'gamjeom')}
              />
            </div>
            <div className="flex flex-col gap-1.5 rounded-2xl bg-red-50 p-2">
              <p className="text-center text-[10px] font-bold uppercase tracking-wider text-red-700">
                Kırmızı (Hakem #{urlRef})
              </p>
              <RefereeScoreButtons
                isReferee={isReferee}
                side={2}
                disabled={state.phase !== 'round'}
                onScore={handleRefButton}
                onGamJeom={(s) => handleRefButton(s, 1, 'gamjeom')}
              />
            </div>
          </div>
        </div>
      )}

      {/* Admin/Guest UI - Ana puan butonları */}
      {(!isReferee || isAdmin) && (
        <div className="grid flex-1 min-h-0 grid-cols-2 gap-1.5 px-2 py-2">
          {/* Mavi butonlar */}
          <div className="flex flex-col gap-1.5 rounded-2xl bg-blue-50 p-2">
            <p className="text-center text-[10px] font-bold uppercase tracking-wider text-blue-700">Mavi Puanları</p>
            <ScoreButtons
              color="blue"
              isAdmin={isAdmin}
              disabled={!canControl || state.phase !== 'round'}
              stats={state.stats[1]}
              score={state.score[1]}
              onScore={(delta, key) => setScore(1, delta, key)}
              onGamJeom={() => addGamJeom(1)}
              onUndo={() => setScore(1, -1)}
            />
          </div>
          {/* Kırmızı butonlar */}
          <div className="flex flex-col gap-1.5 rounded-2xl bg-red-50 p-2">
            <p className="text-center text-[10px] font-bold uppercase tracking-wider text-red-700">Kırmızı Puanları</p>
            <ScoreButtons
              color="red"
              isAdmin={isAdmin}
              disabled={!canControl || state.phase !== 'round'}
              stats={state.stats[2]}
              score={state.score[2]}
              onScore={(delta, key) => setScore(2, delta, key)}
              onGamJeom={() => addGamJeom(2)}
              onUndo={() => setScore(2, -1)}
            />
          </div>
        </div>
      )}

      {/* Alt kontrol bar - kompakt */}
      <div className="flex items-center justify-center gap-2 border-t border-app-border bg-white/70 px-3 py-2 backdrop-blur">
        {state.phase === 'idle' ? (
          <button
            onClick={startMatch}
            disabled={!canControl}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg active:scale-95 disabled:opacity-50"
          >
            <Play className="h-4 w-4" /> BAŞLAT
          </button>
        ) : state.phase === 'finished' ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">
            <Trophy className="h-4 w-4" />
            {state.winner === 1 ? 'MAVİ' : 'KIRMIZI'} KAZANDI
          </div>
        ) : (
          <>
            <button
              onClick={pauseToggle}
              disabled={!isAdmin}
              className="flex items-center gap-1 rounded-xl bg-slate-700 px-4 py-2 text-sm font-bold text-white active:scale-95 disabled:opacity-50"
            >
              {state.timerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {state.timerRunning ? 'Duraklat' : 'Devam'}
            </button>
            <button
              onClick={handleRoundEnd}
              disabled={!isAdmin || state.phase !== 'round'}
              className="rounded-xl border-2 border-slate-700 bg-white px-4 py-2 text-sm font-bold text-slate-700 active:scale-95 disabled:opacity-50"
            >
              Raunt Bitir
            </button>
            {isAdmin && (
              <button
                onClick={resetMatch}
                className="rounded-xl border border-app-border bg-white px-3 py-2 text-xs text-slate-600 active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
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

      {/* QR Modal - en üstte (z-50) */}
      {showInvite && inviteQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowInvite(false)}>
          <div className="glass-panel rounded-2xl bg-white p-5 max-w-xs w-full text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Davet QR Kodu</h3>
              <button onClick={() => setShowInvite(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <img src={inviteQr} alt="Davet QR" className="mx-auto h-48 w-48" />
            <p className="mt-3 text-xs text-brand-muted">Tarayıp paylaşın</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={copyInvite}
                className="flex-1 btn-primary text-xs"
              >
                Linki Kopyala
              </button>
              <button
                onClick={() => setShowInvite(false)}
                className="flex-1 rounded-lg border border-app-border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-app-bg-soft"
              >
                Kapat
              </button>
            </div>
          </div>
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

function ScoreButtons({
  color,
  isAdmin,
  disabled,
  stats,
  score,
  onScore,
  onGamJeom,
  onUndo,
}: {
  color: 'blue' | 'red'
  isAdmin: boolean
  disabled: boolean
  stats: Stats
  score: number
  onScore: (delta: number, statKey?: keyof Stats) => void
  onGamJeom: () => void
  onUndo: () => void
}) {
  const isBlue = color === 'blue'
  const btnBase = isBlue
    ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
    : 'bg-red-600 text-white border-red-700 hover:bg-red-700'
  const gjBase = isBlue
    ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
    : 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
  const undoBase = isBlue
    ? 'bg-slate-500 text-white border-slate-600 hover:bg-slate-600'
    : 'bg-slate-500 text-white border-slate-600 hover:bg-slate-600'

  const buttons = [
    { d: 6, k: 'turnHead' as const, label: '+6' },
    { d: 4, k: 'turnBody' as const, label: '+4' },
    { d: 3, k: 'straightHead' as const, label: '+3' },
    { d: 2, k: 'straightBody' as const, label: '+2' },
    { d: 1, k: 'punch' as const, label: '+1' },
  ]

  return (
    <>
      {buttons.map(({ d, k, label }) => (
        <button
          key={k}
          disabled={disabled || !isAdmin}
          onClick={() => onScore(d, k)}
          className={`flex flex-1 items-center justify-center rounded-xl border-2 ${btnBase} py-3 text-2xl font-black shadow active:scale-95 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {label}
        </button>
      ))}
      {/* Admin-only undo (-1) — only when score > 0 */}
      {isAdmin && score > 0 && (
        <button
          disabled={disabled}
          onClick={onUndo}
          className={`flex flex-1 items-center justify-center rounded-xl border-2 ${undoBase} py-3 text-2xl font-black shadow active:scale-95 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          -1
        </button>
      )}
      <button
        disabled={disabled || !isAdmin || stats.gamjeom >= 5}
        onClick={onGamJeom}
        className={`flex items-center justify-center gap-1 rounded-xl border-2 ${gjBase} py-2 text-xs font-bold shadow active:scale-95 disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <AlertTriangle className="h-3.5 w-3.5" /> GJ {stats.gamjeom}/5
      </button>
    </>
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