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
  Settings,
  ArrowLeft,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useAudio } from '../hooks/useAudio'
import QRCode from 'qrcode'
import { v4 as uuidv4 } from 'uuid'

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
  id: string
  matchSessionId: string
  refId: number
  side: Side
  delta: number
  statKey: keyof Stats | 'gamjeom'
  ts: number
}

type RefereeStatus = {
  connected: boolean
  lastSeen: number
  role: string
}

type MatchState = {
  matchId: string
  matchSessionId: string
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
  voteToleranceMs: number // Yeni: Hakem oyu tolerans süresi
  gapMatchScore: number // Puan farkı limiti
  pendingVotes: RefVote[]
  isTestMode: boolean
  testSignals: Record<number, { action: string, side: Side } | null> // refId: {action, side}
  // referee connection status (admin panel)
  refereeStatus: Record<number, RefereeStatus>
}

// Global vars for persistence
let globalRoundDuration = 120
let globalBreakDuration = 30
let globalGapScore = 15

const emptyStats = (): Stats => ({
  punch: 0,
  straightBody: 0,
  straightHead: 0,
  turnBody: 0,
  turnHead: 0,
  gamjeom: 0,
})

const initialState = (matchId: string, matchSessionId: string = uuidv4()): MatchState => ({
  matchId,
  matchSessionId,
  startedAt: Date.now(),
  athlete1: null,
  athlete2: null,
  score: { 1: 0, 2: 0 },
  stats: { 1: emptyStats(), 2: emptyStats() },
  roundWins: { 1: 0, 2: 0 },
  currentRound: 1,
  roundWinners: {},
  roundDurationSec: globalRoundDuration,
  breakDurationSec: globalBreakDuration,
  timerSec: globalRoundDuration,
  timerRunning: false,
  phase: 'idle',
  winner: null,
  refereeWinner: null,
  voteToleranceMs: 1500, // Yeni: Varsayılan 1500ms tolerans
  gapMatchScore: 15,
  pendingVotes: [],
  isTestMode: false,
  testSignals: { 1: null, 2: null, 3: null },
  refereeStatus: { 1: { connected: false, lastSeen: 0, role: '' }, 2: { connected: false, lastSeen: 0, role: '' }, 3: { connected: false, lastSeen: 0, role: '' } },
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
  const { play, vibrate } = useAudio()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const urlMatchId = params.get('matchId') || ''
  const urlRef = parseInt(params.get('ref') || '0', 10)

  // Admin = authenticated user (logged in)
  const isAuthAdmin = status === 'authenticated' && !!user

  // Ref mode: ?ref=1/2/3 ile gelen hakem
  const isReferee = urlRef >= 1 && urlRef <= 3 || !urlMatchId

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return isAuthAdmin || sessionStorage.getItem('liveScore:admin') === '1'
  })

  // matchId: önce URL, yoksa yeni UUID
  const [matchId] = useState<string>(() => {
    if (urlMatchId) return urlMatchId
    return uuidv4()
  })

  // Use global settings on init
  const [state, setState] = useState<MatchState>(() => {
    const s = initialState(matchId)
    s.gapMatchScore = globalGapScore
    return s
  })

  // Sync isAdmin with auth status
  useEffect(() => {
    if (isAuthAdmin) setIsAdmin(true)
  }, [isAuthAdmin])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const [athletes, setAthletes] = useState<AthleteMini[]>([])
  const [refereeOpen, setRefereeOpen] = useState(false)
  const [roundEndConfirmOpen, setRoundEndConfirmOpen] = useState(false)
  const [roundWinnerPopup, setRoundWinnerPopup] = useState<{ winner: Side; method?: string } | null>(null)
  const [pendingRoundWinner, setPendingRoundWinner] = useState<Side | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [refereeQrs, setRefereeQrs] = useState<Record<number, string>>({})

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
        const vote = payload as RefVote
        if (stateRef.current.isTestMode) {
          setState(prev => ({ ...prev, testSignals: { ...prev.testSignals, [vote.refId]: { action: vote.statKey || 'test', side: vote.side } } }))
        } else {
          handleIncomingVote(vote)
        }
      }
    })
    // Presence sync
    ch.on('presence', { event: 'sync' }, () => {
      const ps = ch.presenceState()
      const newRefStatus: Record<number, RefereeStatus> = {
        1: { connected: false, lastSeen: 0, role: '' },
        2: { connected: false, lastSeen: 0, role: '' },
        3: { connected: false, lastSeen: 0, role: '' },
      }
      Object.values(ps).forEach((arr: any[]) => {
        arr.forEach((p: any) => {
          if (p.ref >= 1 && p.ref <= 3) {
            newRefStatus[p.ref] = { connected: true, lastSeen: Date.now(), role: p.role || 'referee' }
          }
        })
      })
      setState((prev) => ({ ...prev, refereeStatus: newRefStatus }))
    })
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ user_id: user?.id || `ref-${urlRef || 'temp'}`, role: isAdmin ? 'admin' : 'referee', ref: urlRef })
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
    if (isAdmin && !urlMatchId && matchId) {
      setParams({ matchId }, { replace: true })
    }
  }, [matchId, isAdmin, urlMatchId, setParams])

  // ── Broadcast (admin ve referee)
  const broadcast = (next: MatchState) => {
    setState(next)
    if (!isAdmin && !isReferee) return
    const ch = channelRef.current
    if (ch) void ch.send({ type: 'broadcast', event: BROADCAST_NAME, payload: next })
  }

  // ── Timer
  useEffect(() => {
    if (!isAdmin) return
    if (!state.timerRunning) return
    const id = setInterval(() => {
      setState((prev: MatchState): MatchState => {
        if (!prev.timerRunning) return prev
        const nextSec = prev.timerSec - 1
        if (nextSec > 0) {
          const next: MatchState = { ...prev, timerSec: nextSec }
          broadcast(next)
          return next
        }
        if (prev.phase === 'round') {
          const next: MatchState = { ...prev, timerSec: 0, timerRunning: false }
          broadcast(next)
          return next
        }
        if (prev.phase === 'break') {
          const next: MatchState = { ...prev, timerSec: prev.roundDurationSec, timerRunning: false, phase: 'round' }
          broadcast(next)
          return next
        }
        return prev
      })
    }, 1000)
    return () => clearInterval(id)
  }, [state.timerRunning, state.phase, isAdmin])

  // ── Helpers
  const canControl = isAdmin && state.athlete1 && state.athlete2

  const finalizeRound = (s: MatchState, winner: Side | null, method?: string): MatchState => {
    const updated: MatchState = { ...s, timerRunning: false }
    if (winner) {
      updated.roundWins = { ...updated.roundWins, [winner]: updated.roundWins[winner] + 1 }
      updated.roundWinners = { ...updated.roundWinners, [updated.currentRound]: winner }
      setRoundWinnerPopup({ winner, method })
    } else {
      updated.roundWinners = { ...updated.roundWinners, [updated.currentRound]: 'draw' }
    }
    if (updated.roundWins[1] >= 2 || updated.roundWins[2] >= 2) {
      play('match-end', isAdmin)
      updated.phase = 'finished'
      updated.winner = updated.roundWins[1] >= 2 ? 1 : 2
      updated.timerSec = 0
      return updated
    }
    updated.score = { 1: 0, 2: 0 }
    updated.stats = { 1: emptyStats(), 2: emptyStats() }
    updated.phase = 'break'
    updated.timerSec = updated.breakDurationSec
    updated.timerRunning = true
    updated.currentRound = updated.currentRound + 1
    return updated
  }

  const setScore = (side: Side, delta: number, statKey?: keyof Stats) => {
    if (!isAdmin && state.phase !== 'round') return
    setState((prev) => {
      const isIncrease = delta > 0
      if (isIncrease) {
        play(side === 1 ? 'score-blue' : 'score-red', isAdmin)
        vibrate(50)
      }
      let next: MatchState = {
        ...prev,
        score: { ...prev.score, [side]: prev.score[side] + delta },
        stats: {
          ...prev.stats,
          [side]: { ...prev.stats[side], ...(statKey ? { [statKey]: prev.stats[side][statKey as keyof Stats] + 1 } : {}) },
        },
      }
      const diff = Math.abs(next.score[1] - next.score[2])
      if (diff >= 15) {
        const winner = next.score[1] > next.score[2] ? 1 : 2
        next = finalizeRound(next, winner, '15 Puan Fark (Gap Match)')
      }
      broadcast(next)
      return next
    })
  }

  const addGamJeom = (penalized: Side) => {
    if (!isAdmin) return
    play('penalized', isAdmin)
    vibrate([100, 50, 100])
    setState((prev) => {
      const opp: Side = penalized === 1 ? 2 : 1
      const penalizedStats = { ...prev.stats[penalized], gamjeom: prev.stats[penalized].gamjeom + 1 }
      const autoRoundLoss = penalizedStats.gamjeom >= 5
      let next: MatchState = {
        ...prev,
        score: { ...prev.score, [opp]: prev.score[opp] + 1 },
        stats: { ...prev.stats, [penalized]: penalizedStats },
      }
      if (autoRoundLoss) {
        next = finalizeRound(next, opp, '5 Gam-jeom Cezası')
      }
      broadcast(next)
      return next
    })
  }

  const handleRoundEnd = () => {
    if (!isAdmin) return
    const w = getWinner(state.score[1], state.score[2], state.stats[1], state.stats[2])
    if (w === null) {
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
      const next = finalizeRound(prev, winner, 'Normal Süre / Kriterler')
      broadcast(next)
      return next
    })
  }

  const confirmRefereeWinner = (side: Side) => {
    setRefereeOpen(false)
    setState((prev) => {
      const next = finalizeRound(prev, side, 'Hakem Kararı (Beraberlik)')
      next.refereeWinner = side
      broadcast(next)
      return next
    })
  }

  const startMatch = () => {
    if (!isAdmin) return
    if (!state.athlete1 || !state.athlete2) return
    play('match-start', isAdmin)
    vibrate(200)
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
    play(state.timerRunning ? 'timer-pause' : 'timer-resume', isAdmin)
    vibrate(100)
    setState((prev) => {
      const next = { ...prev, timerRunning: !prev.timerRunning }
      broadcast(next)
      return next
    })
  }

  const skipBreak = () => {
    if (!isAdmin || state.phase !== 'break') return
    setState((prev) => {
      const next: MatchState = { ...prev, timerSec: prev.roundDurationSec, phase: 'round', timerRunning: true }
      broadcast(next)
      return next
    })
  }

  const resetMatch = () => {
    if (!isAdmin) return
    if (!confirm('Maçı sıfırla?')) return
    const fresh = initialState(matchId)
    fresh.roundDurationSec = state.roundDurationSec
    fresh.breakDurationSec = state.breakDurationSec
    broadcast(fresh)
  }

  const newMatch = (_e?: React.MouseEvent<HTMLButtonElement>, keepAthletes = false) => {
    if (!isAdmin) return
    const fresh = initialState(matchId, uuidv4())
    fresh.roundDurationSec = state.roundDurationSec
    fresh.breakDurationSec = state.breakDurationSec
    if (keepAthletes) {
      fresh.athlete1 = state.athlete1
      fresh.athlete2 = state.athlete2
    }
    setState(fresh)
    broadcast(fresh)
  }

  const setAthlete = (side: Side, a: AthleteMini | null) => {
    if (!isAdmin) return
    setState((prev) => {
      const next = { ...prev, [side === 1 ? 'athlete1' : 'athlete2']: a }
      broadcast(next)
      return next
    })
  }

  const broadcastVote = (vote: RefVote) => {
    vibrate(50)
    const ch = channelRef.current
    if (ch) void ch.send({ type: 'broadcast', event: 'vote', payload: vote })
  }

  const handleIncomingVote = (incomingVote: RefVote) => {
    setState((prev) => {
      if (incomingVote.matchSessionId !== prev.matchSessionId) return prev
      const now = Date.now()
      const freshVotes = [...prev.pendingVotes, incomingVote].filter(v => now - v.ts <= prev.voteToleranceMs)
      const activeRefCount = Object.values(prev.refereeStatus).filter(r => r.connected).length
      const required = activeRefCount <= 1 ? 1 : 2
      
      const voteGroups = freshVotes.reduce((acc, v) => {
        const key = `${v.side}-${v.delta}-${v.statKey}`
        if (!acc[key]) acc[key] = []
        const existingGroup = acc[key].find(g => Math.abs(g[0].ts - v.ts) <= 750)
        if (existingGroup) existingGroup.push(v)
        else acc[key].push([v])
        return acc
      }, {} as Record<string, RefVote[][]>)

      let consensusGroup: RefVote[] | null = null
      Object.values(voteGroups).forEach(groups => {
        groups.forEach(g => {
          const uniqueRefs = new Set(g.map(v => v.refId))
          if (uniqueRefs.size >= required) consensusGroup = g
        })
      })
      
      if (!consensusGroup) return { ...prev, pendingVotes: freshVotes }

      const usedVotes = (consensusGroup as RefVote[]).slice(0, required)
      play(usedVotes[0].side === 1 ? 'score-blue' : 'score-red', isAdmin)
      const usedIds = new Set(usedVotes.map(v => v.id))

      const side = usedVotes[0].side
      const delta = usedVotes[0].delta
      const statKey = usedVotes[0].statKey
      const scoreSide = statKey === 'gamjeom' ? (side === 1 ? 2 : 1) : side

      let next: MatchState = {
        ...prev,
        score: { ...prev.score, [scoreSide]: prev.score[scoreSide] + delta },
        stats: {
          ...prev.stats,
          [side]: { ...prev.stats[side], [statKey]: prev.stats[side][statKey as keyof Stats] + 1 }
        },
        pendingVotes: freshVotes.filter(v => !usedIds.has(v.id))
      }

      if (Math.abs(next.score[1] - next.score[2]) >= 15) next = finalizeRound(next, next.score[1] > next.score[2] ? 1 : 2, 'Gap Match')
      else if (statKey === 'gamjeom' && next.stats[side].gamjeom >= 5) next = finalizeRound(next, side === 1 ? 2 : 1, '5 Gam-jeom')

      broadcast(next)
      return next
    })
  }

  function RefereeScoreButtons({
    isReferee,
    side,
    disabled,
    onScore,
  }: {
    isReferee: boolean
    side: Side
    disabled: boolean
    onScore: (vote: RefVote) => void
  }) {
    const buttons = [
      { d: 6, k: 'turnHead' as const, label: '+6' },
      { d: 4, k: 'turnBody' as const, label: '+4' },
      { d: 3, k: 'straightHead' as const, label: '+3' },
      { d: 2, k: 'straightBody' as const, label: '+2' },
      { d: 1, k: 'punch' as const, label: '+1' },
    ]

    return (
      <div className="grid grid-cols-1 gap-2 p-1">
        {buttons.map(({ d, k, label }) => (
          <button
            key={k}
            disabled={disabled || !isReferee}
            onClick={() => onScore({ 
              id: uuidv4(), 
              matchSessionId: state.matchSessionId, 
              refId: urlRef, 
              side, 
              delta: d, 
              statKey: k, 
              ts: Date.now() 
            })}
            className={`flex-1 flex items-center justify-center rounded-2xl border-4 ${
              side === 1 ? 'bg-blue-600 text-white border-blue-700' : 'bg-red-600 text-white border-red-700'
            } py-4 text-3xl font-black shadow-lg active:scale-95 disabled:opacity-40`}
          >
            {label}
          </button>
        ))}
      </div>
    )
  }

  const mm = String(Math.floor(state.timerSec / 60)).padStart(2, '0')
  const ss = String(state.timerSec % 60).padStart(2, '0')
  const phaseLabel =
    state.phase === 'idle' ? 'Hazır' :
    state.phase === 'round' ? 'Raunt' :
    state.phase === 'break' ? 'Ara' : 'Bitti'

  return (
    <div className="flex h-screen h-[100dvh] flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex flex-none items-center justify-between gap-2 border-b border-app-border bg-white/60 px-3 py-2 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex items-center gap-2 text-xs text-brand-muted">
          <button onClick={() => navigate('/dashboard')} className="p-1 hover:bg-slate-200 rounded-full"><ArrowLeft className="h-3 w-3" /></button>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{matchId.slice(0, 6)}</span>
          <span>{isAdmin ? 'Admin' : isReferee ? `Hakem #${urlRef}` : ''}</span>
        </div>
      </div>
      <div className="flex flex-[2] flex-col gap-1 p-1">
        <div className="flex flex-[2] gap-1">
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl bg-red-600 text-white shadow-lg">
            <p className="text-xs font-bold uppercase">Kırmızı</p>
            <p className="text-7xl font-black">{state.score[2]}</p>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg">
            <p className="text-xs font-bold uppercase">Mavi</p>
            <p className="text-7xl font-black">{state.score[1]}</p>
          </div>
        </div>
        <div className="flex flex-[1] items-center justify-center rounded-lg bg-slate-900 text-white shadow">
          <p className="font-mono text-5xl font-black">{mm}:{ss}</p>
        </div>
      </div>
      {isReferee && (
        <div className="flex flex-col flex-[2] bg-slate-50 p-2">
            <RefereeScoreButtons isReferee={isReferee} side={2} disabled={!(state.phase === 'round' || state.isTestMode)} onScore={broadcastVote} />
            <RefereeScoreButtons isReferee={isReferee} side={1} disabled={!(state.phase === 'round' || state.isTestMode)} onScore={broadcastVote} />
        </div>
      )}
      {(isAdmin || !isReferee) && (
        <div className="flex flex-[3] flex-col px-2 pb-2 overflow-y-auto">
            <ScoreButtons color="red" isAdmin={isAdmin} disabled={!canControl || state.phase !== 'round'} stats={state.stats[2]} score={state.score[2]} onScore={(d, k) => setScore(2, d, k)} onGamJeom={() => addGamJeom(2)} onUndo={() => setScore(2, -1)} />
            <ScoreButtons color="blue" isAdmin={isAdmin} disabled={!canControl || state.phase !== 'round'} stats={state.stats[1]} score={state.score[1]} onScore={(d, k) => setScore(1, d, k)} onGamJeom={() => addGamJeom(1)} onUndo={() => setScore(1, -1)} />
        </div>
      )}
      {isAdmin && (
        <div className="flex items-center justify-center gap-2 border-t p-2">
          {state.phase === 'idle' ? <button onClick={startMatch} disabled={!canControl} className="bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold">BAŞLAT</button> : 
          <button onClick={pauseToggle} className="bg-slate-700 text-white px-4 py-2 rounded-xl">{state.timerRunning ? 'Duraklat' : 'Devam'}</button>}
        </div>
      )}
    </div>
  )
}

function AthleteSelect({ label, color, athletes, value, onChange, disabled }: { label: string, color: 'blue' | 'red', athletes: AthleteMini[], value: AthleteMini | null, onChange: (a: AthleteMini | null) => void, disabled?: boolean }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const filtered = useMemo(() => athletes.filter((a) => `${a.first_name} ${a.last_name}`.toLowerCase().includes(q.toLowerCase())).slice(0, 50), [q, athletes])
  return (
    <div>
      <label className="text-xs font-medium text-slate-700">{label}</label>
      {value ? (
        <div className="flex items-center justify-between rounded-lg border p-2">{value.first_name} {value.last_name} <button onClick={() => onChange(null)}><X className="h-4 w-4" /></button></div>
      ) : (
        <div className="relative">
          <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} placeholder="Ara..." className="w-full border p-2" />
          {open && (
            <div className="absolute z-10 w-full bg-white border">
              {filtered.map(a => <button key={a.id} className="block w-full p-2 text-left" onClick={() => { onChange(a); setOpen(false) }}>{a.first_name} {a.last_name}</button>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ScoreButtons({ color, isAdmin, disabled, stats, score, onScore, onGamJeom, onUndo }: { color: 'blue' | 'red', isAdmin: boolean, disabled: boolean, stats: Stats, score: number, onScore: (d: number, k?: keyof Stats) => void, onGamJeom: () => void, onUndo: () => void }) {
  const isBlue = color === 'blue'
  const btnBase = isBlue ? 'bg-blue-600' : 'bg-red-600'
  const buttons = [{ d: 6, k: 'turnHead' as const, l: '+6' }, { d: 4, k: 'turnBody' as const, l: '+4' }, { d: 3, k: 'straightHead' as const, l: '+3' }, { d: 2, k: 'straightBody' as const, l: '+2' }, { d: 1, k: 'punch' as const, l: '+1' }]
  return (
    <>
      {buttons.map(b => <button key={b.k} disabled={disabled || !isAdmin} onClick={() => onScore(b.d, b.k)} className={`p-4 text-white ${btnBase}`}>{b.l}</button>)}
      {isAdmin && score > 0 && <button disabled={disabled} onClick={onUndo} className="p-4 bg-slate-500 text-white">-1</button>}
      <button disabled={disabled || !isAdmin || stats.gamjeom >= 5} onClick={onGamJeom} className="p-4 bg-amber-500 text-white">GAM</button>
    </>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 flex items-center justify-center bg-black/40"><div className="bg-white p-5 rounded-2xl w-full max-w-sm">{title}<button onClick={onClose}>Kapat</button>{children}</div></div>
}