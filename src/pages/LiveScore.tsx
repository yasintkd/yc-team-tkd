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
  phase: 'idle' | 'round' | 'break' | 'finished' | 'interrupted' // 'interrupted' eklendi
  // match meta
  winner: Side | null
  refereeWinner: Side | null
  // referee consensus (1-3 hakem)
  voteToleranceMs: 1500 // Yeni: Hakem oyu tolerans süresi
  gapMatchScore: number // Puan farkı limiti
  pendingVotes: RefVote[]
  isTestMode: boolean
  testSignals: Record<number, { action: string, side: Side } | null> // refId: {action, side}
  // referee connection status (admin panel)
  refereeStatus: Record<number, RefereeStatus>
  // Tie-breaker vote
  tieVoteActive: boolean
  refereeTieVotes: Record<Side, number>
  roundScores: Record<number, Record<Side, number>> // Yeni: Her raunt için skor geçmişi
  matchEndReason: string | null // Yeni: Maç bitiş nedeni
  lastAction: { type: 'score' | 'gamjeom', side: Side, delta?: number, statKey?: keyof Stats, round: number } | null // Yeni: Son admin aksiyonu
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
  phase: 'idle', // 'interrupted' olarak başlatılmayacak
  winner: null,
  refereeWinner: null,
  voteToleranceMs: 1500, // Yeni: Varsayılan 1500ms tolerans
  gapMatchScore: 15,
  pendingVotes: [],
  isTestMode: false,
  testSignals: { 1: null, 2: null, 3: null },
  refereeStatus: { 1: { connected: false, lastSeen: 0, role: '' }, 2: { connected: false, lastSeen: 0, role: '' }, 3: { connected: false, lastSeen: 0, role: '' } },
  tieVoteActive: false,
  refereeTieVotes: { 1: 0, 2: 0 },
  roundScores: {}, // Başlangıçta boş
  matchEndReason: null, // Başlangıçta boş
  lastAction: null, // Başlangıçta boş
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
  const { play } = useAudio()
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
  const [showEndMatchModal, setShowEndMatchModal] = useState(false) // Yeni: Maç bitirme modalı
  const [endMatchReason, setEndMatchReason] = useState('Antrenör Çekildi') // Yeni: Maç bitiş nedeni
  const [endMatchWinner, setEndMatchWinner] = useState<Side | null>(null) // Yeni: Maç galibi


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
    // Beraberlik oylaması isteği
    ch.on('broadcast', { event: 'tie_vote_request' }, ({ payload }) => {
      if (payload && typeof payload === 'object') {
        const { currentRound, matchSessionId } = payload as { currentRound: number, matchSessionId: string }
        // Sadece ilgili raunt ve oturum için oylama popup'ı göster
        if (stateRef.current.currentRound === currentRound && stateRef.current.matchSessionId === matchSessionId) {
          setState(prev => ({ ...prev, tieVoteActive: true, refereeTieVotes: { 1: 0, 2: 0 } })) // Hakem cihazında oylama aktif et
        }
      }
    })
    // Gelen beraberlik oyları
    ch.on('broadcast', { event: 'tie_vote' }, ({ payload }) => {
      if (payload && typeof payload === 'object') {
        const { side, matchSessionId, round } = payload as { side: Side, matchSessionId: string, round: number }
        if (stateRef.current.matchSessionId === matchSessionId && stateRef.current.currentRound === round) {
          // Admin tarafında oy topla
          setState(prev => ({
            ...prev,
            refereeTieVotes: { ...prev.refereeTieVotes, [side]: prev.refereeTieVotes[side] + 1 }
          }))
        }
      }
    })
    // Presence: yeni client katıldığında mevcut state'i broadcast et (sadece admin)
    ch.on('presence', { event: 'join' }, ({ newPresences }) => {
      const joined = newPresences.find((p: any) => p.user_id !== user?.id)
      if (joined && isAdmin) {
        const ch2 = channelRef.current
        if (ch2 && stateRef.current) {
          void ch2.send({ type: 'broadcast', event: BROADCAST_NAME, payload: stateRef.current })
        }
      }
      // Hakem bağlandığında refereeStatus güncelle
      newPresences.forEach((p: any) => {
        if (p.ref >= 1 && p.ref <= 3) {
          setState((prev) => ({
            ...prev,
            refereeStatus: {
              ...prev.refereeStatus,
              [p.ref]: { connected: true, lastSeen: Date.now(), role: p.role || 'referee' },
            },
          }))
        }
      })
    })
    // Presence: client ayrıldığında refereeStatus güncelle
    ch.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      leftPresences.forEach((p: any) => {
        if (p.ref >= 1 && p.ref <= 3) {
          setState((prev) => ({
            ...prev,
            refereeStatus: {
              ...prev.refereeStatus,
              [p.ref]: { ...prev.refereeStatus[p.ref], connected: false, lastSeen: Date.now() },
            },
          }))
        }
      })
    })
    // Presence sync: mevcut presence state'inden hakemleri oku
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
        // Presence'e gir
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
    // Sadece admin veya referee broadcast yapabilir
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
        // süre bitti
    if (prev.phase === 'round') {
      const next: MatchState = { ...prev, timerSec: 0, timerRunning: false }
      broadcast(next)
      // Eğer süre 0 ise ve admin hala müdahale ediyorsa, fazı "interrupted" olarak ayarla
      if (isAdmin && stateRef.current.timerSec <= 0) {
        next.phase = 'interrupted'
      }
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

  // ── Süre 0'a inince otomatik raunt bitir kontrolü (admin)
  useEffect(() => {
    if (!isAdmin) return
    if (state.phase !== 'round') return
    if (state.timerRunning) return
    if (state.timerSec !== 0) return
    // otomatik raunt sonu
    handleRoundEnd(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.timerRunning, state.timerSec, isAdmin])

  // ── Helpers
  const activeRefCount = Object.values(state.refereeStatus).filter(r => r.connected).length
  const isAdminAlsoVoting = activeRefCount === 2 // 2 hakem varsa admin de oylamaya dahil
  const canControl = isAdmin && state.athlete1 && state.athlete2

  const setScore = (side: Side, delta: number, statKey?: keyof Stats, recordAction = true) => {
    // Admin, raunt sırasında veya kesintide kontrol edebilir
    if (!isAdmin || (state.phase !== 'round' && state.phase !== 'interrupted')) return
    setState((prev) => {
      const isIncrease = delta > 0
      if (isIncrease) play(side === 1 ? 'score-blue' : 'score-red', true)
      let next: MatchState = {
        ...prev,
        score: { ...prev.score, [side]: prev.score[side] + delta },
        stats: {
          ...prev.stats,
          [side]: { ...prev.stats[side], ...(statKey ? { [statKey]: prev.stats[side][statKey] + (delta > 0 ? 1 : -1) } : {}) }, // Stat key'i güncellerken delta yönünü kullan
        },
      }
      // Son aksiyonu kaydet
      if (recordAction) {
        next.lastAction = { type: 'score', side, delta, statKey, round: prev.currentRound }
      } else {
        next.lastAction = null // Geri alma işlemi ise lastAction'ı sıfırla
      }

      const diff = Math.abs(next.score[1] - next.score[2])
      if (diff >= next.gapMatchScore) { // next.gapMatchScore kullan
        const winner = next.score[1] > next.score[2] ? 1 : 2
        next = finalizeRound(next, winner, '15 Puan Fark (Gap Match)')
      }
      broadcast(next)
      return next
    })
  }

  const addGamJeom = (penalized: Side, recordAction = true) => {
    // Admin, raunt sırasında veya kesintide kontrol edebilir
    if (!isAdmin || (state.phase !== 'round' && state.phase !== 'interrupted')) return
    play('penalized', true)
    setState((prev) => {
      const opp: Side = penalized === 1 ? 2 : 1
      const penalizedStats = { ...prev.stats[penalized], gamjeom: prev.stats[penalized].gamjeom + 1 }
      const autoRoundLoss = penalizedStats.gamjeom >= 5
      let next: MatchState = {
        ...prev,
        score: { ...prev.score, [opp]: prev.score[opp] + 1 },
        stats: { ...prev.stats, [penalized]: penalizedStats },
      }
      // Son aksiyonu kaydet
      if (recordAction) {
        next.lastAction = { type: 'gamjeom', side: penalized, delta: 1, round: prev.currentRound }
      } else {
        next.lastAction = null // Geri alma işlemi ise lastAction'ı sıfırla
      }

      if (autoRoundLoss) {
        next = finalizeRound(next, opp, '5 Gam-jeom Cezası')
      }
      broadcast(next)
      return next
    })
  }

  const undoLastAction = () => {
    if (!isAdmin || !state.lastAction) return // Sadece admin ve kayıtlı bir aksiyon varsa
    setState(prev => {
      let next: MatchState = { ...prev }
      const last = prev.lastAction!

      if (last.round !== prev.currentRound) {
        console.warn('Geri alma sadece mevcut raunt için geçerlidir.')
        return prev
      }

      if (last.type === 'score') {
        const reversedDelta = -last.delta!
        const scoreSide = last.statKey === 'gamjeom' ? (last.side === 1 ? 2 : 1) : last.side
        next.score = { ...prev.score, [scoreSide]: prev.score[scoreSide] + reversedDelta }
        next.stats = {
          ...prev.stats,
          [last.side]: { ...prev.stats[last.side], [last.statKey!]: prev.stats[last.side][last.statKey as keyof Stats] - 1 }
        }
      } else if (last.type === 'gamjeom') {
        const opp: Side = last.side === 1 ? 2 : 1
        next.score = { ...prev.score, [opp]: prev.score[opp] - 1 }
        next.stats = { ...prev.stats, [last.side]: { ...prev.stats[last.side], gamjeom: prev.stats[last.side].gamjeom - 1 } }
      }

      next.lastAction = null // Aksiyon geri alındı, sıfırla
      broadcast(next)
      return next
    })
  }

  const finalizeRound = (s: MatchState, winner: Side | null, method?: string): MatchState => {
    triggerVibrate()
    const updated: MatchState = { ...s, timerRunning: false }
    if (winner) {
      updated.roundWins = { ...updated.roundWins, [winner]: updated.roundWins[winner] + 1 }
      updated.roundWinners = { ...updated.roundWinners, [updated.currentRound]: winner }
      setRoundWinnerPopup({ winner, method })
    } else {
      updated.roundWinners = { ...updated.roundWinners, [updated.currentRound]: 'draw' }
    }
    // Best of 3 → 2 kazanan bitti
    if (updated.roundWins[1] >= 2 || updated.roundWins[2] >= 2) {
      play('match-end', true)
      updated.phase = 'finished'
      updated.winner = updated.roundWins[1] >= 2 ? 1 : 2
      updated.timerSec = 0
      return updated
    }
    // Mevcut raunt skorlarını kaydet
    updated.roundScores = {
      ...updated.roundScores,
      [updated.currentRound]: { 1: s.score[1], 2: s.score[2] }
    }

    // sonraki raunt → puanları sıfırla, araya geç ve ara süresini otomatik başlat
    updated.score = { 1: 0, 2: 0 }
    updated.stats = { 1: emptyStats(), 2: emptyStats() }
    updated.phase = 'break'
    updated.timerSec = updated.breakDurationSec
    updated.timerRunning = true
    updated.currentRound = updated.currentRound + 1
    return updated
  }

  const handleRoundEnd = (isAutomatic: boolean = false) => {
    if (!isAdmin) return
    const w = getWinner(
      state.score[1],
      state.score[2],
      state.stats[1],
      state.stats[2],
    )
    const activeRefCount = Object.values(state.refereeStatus).filter(r => r.connected).length
    const isAdminAlsoVoting = activeRefCount === 2 // 2 hakem varsa admin de oylamaya dahil

    if (w === null) { // Beraberlik durumu (tie-breaker da eşit)
      if (activeRefCount === 0) { // Hakem yoksa, admin manuel belirlesin
        setPendingRoundWinner(null)
        setRefereeOpen(true)
        return
      }

      // Hakemler bağlıysa oylama başlat
      setState(prev => ({
        ...prev,
        tieVoteActive: true,
        refereeTieVotes: { 1: 0, 2: 0 } // Oyları sıfırla
      }))
      // Hakem cihazlarına oylama isteği gönder
      const ch = channelRef.current
      if (ch) void ch.send({
        type: 'broadcast',
        event: 'tie_vote_request',
        payload: { currentRound: state.currentRound, matchSessionId: state.matchSessionId }
      })
      return
    }

    // Galip belirlendi
    if (isAutomatic) { // Otomatik süre bitimi ise onaya gerek yok
      setState((prev) => {
        const next = finalizeRound(prev, w, 'Süre Sonu / Kriterler')
        broadcast(next)
        return next
      })
    } else { // Admin manuel bitiriyorsa onay sorulsun
      setPendingRoundWinner(w)
      setRoundEndConfirmOpen(true)
    }
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

  const confirmEndMatch = () => {
    if (!isAdmin || !endMatchWinner || !endMatchReason) return
    setState(prev => {
      let next: MatchState = { ...prev }
      next.phase = 'finished'
      next.winner = endMatchWinner
      next.matchEndReason = endMatchReason
      next.timerRunning = false
      next.timerSec = 0
      broadcast(next)
      return next
    })
    setShowEndMatchModal(false)
    setEndMatchWinner(null)
    setEndMatchReason('Antrenör Çekildi')
  }

  const setRoundDuration = (v: number) => {
    if (!isAdmin) return
    globalRoundDuration = v
    setState((prev) => ({ ...prev, roundDurationSec: v, timerSec: prev.phase === 'idle' || prev.phase === 'finished' ? v : prev.timerSec }))
  }
  const setBreakDuration = (v: number) => {
    if (!isAdmin) return
    globalBreakDuration = v
    setState((prev) => ({ ...prev, breakDurationSec: v }))
  }
  const setGapScore = (v: number) => {
    if (!isAdmin) return
    globalGapScore = v
    setState((prev) => ({ ...prev, gapMatchScore: v }))
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: suppress unused warning
  void setRoundDuration
  // biome-ignore lint/correctness/useExhaustiveDependencies: suppress unused warning
  void setBreakDuration

  const startMatch = () => {
    if (!isAdmin) return
    if (!state.athlete1 || !state.athlete2) return
    play('match-start', true)
    const next: MatchState = {
      ...state,
      phase: 'round',
      timerRunning: true,
      timerSec: state.roundDurationSec,
      currentRound: 1,
    }
    broadcast(next)
  }


  const triggerVibrate = (pattern: number | number[] = [100, 50, 100]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern)
  }

  const pauseToggle = () => {
    if (!isAdmin) return
    triggerVibrate()
    setState((prev) => {
      play(prev.timerRunning ? 'timer-pause' : 'timer-resume', true)
      const next = { ...prev, timerRunning: !prev.timerRunning }
      broadcast(next)
      return next
    })
  }

  const skipBreak = () => {
    if (!isAdmin || state.phase !== 'break') return
    triggerVibrate()
    setState((prev) => {
      const next: MatchState = { ...prev, timerSec: prev.roundDurationSec, phase: 'round', timerRunning: true }
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

  // ── Referee consensus helpers ──────────────────────────

  const broadcastVote = (vote: RefVote) => {
    // Hakem cihazında sadece titreşim
    triggerVibrate(200)
    
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
      
      // Grupla ama vote ID'lerini tut
      // Oyları Side-Delta-Type ve Zaman Penceresine (300ms) göre grupla
      const voteGroups = freshVotes.reduce((acc, v) => {
        const key = `${v.side}-${v.delta}-${v.statKey}`
        if (!acc[key]) acc[key] = []
        
        // Bu teknik için mevcut grupları kontrol et (750ms penceresi)
        const existingGroup = acc[key].find(g => Math.abs(g[0].ts - v.ts) <= 750)
        if (existingGroup) {
          existingGroup.push(v)
        } else {
          acc[key].push([v])
        }
        return acc
      }, {} as Record<string, RefVote[][]>)

      // Konsensüs sağlayan grubu bul
      let consensusGroup: RefVote[] | null = null
      Object.values(voteGroups).forEach(groups => {
        groups.forEach(g => {
          const uniqueRefs = new Set(g.map(v => v.refId))
          if (uniqueRefs.size >= required) consensusGroup = g
        })
      })
      
      if (!consensusGroup) return { ...prev, pendingVotes: freshVotes }

      const usedVotes = (consensusGroup as RefVote[]).slice(0, required)
      play(usedVotes[0].side === 1 ? 'score-blue' : 'score-red', true)
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

  // ── RefereeScoreButtons component (hakem UI) ───────────

  function RefereeScoreButtons({
    isReferee: _isReferee,
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

    const isDisabled = disabled || state.phase !== 'round' || !state.timerRunning || state.timerSec <= 0

    return (
      <div className="grid grid-cols-1 grid-rows-5 gap-2 h-full p-1">
        {buttons.map(({ d, k, label }) => (
          <button
            key={k}
            disabled={isDisabled}
            onClick={() => {
              if (isDisabled) return
              triggerVibrate(200)
              onScore({ 
                id: uuidv4(), 
                matchSessionId: state.matchSessionId, 
                refId: urlRef, 
                side, 
                delta: d, 
                statKey: k, 
                ts: Date.now() 
              })
            }}
            className={`flex h-full min-h-0 items-center justify-center rounded-2xl border-4 ${
              side === 1 ? 'bg-blue-600 text-white border-blue-700' : 'bg-red-600 text-white border-red-700'
            } text-4xl font-black shadow-lg active:scale-95 disabled:opacity-40`}
          >
            {label}
          </button>
        ))}
      </div>
    )
  }

  // ── UI (tam ekran) ─────────────────────────────────────

  const mm = String(Math.floor(state.timerSec / 60)).padStart(2, '0')
  const ss = String(state.timerSec % 60).padStart(2, '0')
  const phaseLabel =
    state.phase === 'idle' ? 'Hazır' :
    state.phase === 'round' ? 'Raunt' :
    state.phase === 'break' ? 'Ara' :
    state.phase === 'interrupted' ? 'Müdahale' : 'Bitti'

  return (
    <div className="flex h-screen h-[100dvh] flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
      {/* Top bar - kompakt */}
      <div className="flex flex-none items-center justify-between gap-2 border-b border-app-border bg-white/60 px-3 py-2 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex items-center gap-2 text-xs text-brand-muted">
          <button onClick={() => navigate('/dashboard')} className="p-1 hover:bg-slate-200 rounded-full"><ArrowLeft className="h-3 w-3" /></button>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{matchId.slice(0, 6)}</span>
          <span>{isAdmin ? 'Admin' : isReferee ? `Hakem #${urlRef}` : ''}</span>
        </div>
        <div className="flex gap-1.5">
          {isAdmin && (
            <>
              {/* Hakem bağlantı durumu paneli */}
              <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500">HAKEMLER:</span>
                {[1, 2, 3].map((r) => {
                  const rs = state.refereeStatus[r]
                  const isConnected = rs?.connected
                  const lastSeen = rs?.lastSeen
                  const timeAgo = lastSeen ? Math.round((Date.now() - lastSeen) / 1000) : null
                  return (
                    <div
                      key={r}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                      title={`Hakem #${r} - ${isConnected ? `Bağlı ${timeAgo ? `${timeAgo}s önce` : 'şimdi'}` : 'Bağlantı yok'}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isConnected ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                      <span className={isConnected ? 'text-emerald-700' : 'text-red-700'}>{r}</span>
                    </div>
                  )
                })}
              </div>
              <button
                onClick={async () => {
                  // Generate QR codes for all 3 referees
                  const qrs: Record<number, string> = {}
                  for (let i = 1; i <= 3; i++) {
                    const refUrl = `${window.location.origin}/canli-skor?matchId=${matchId}&ref=${i}`
                    try {
                      qrs[i] = await QRCode.toDataURL(refUrl, { width: 120, margin: 1 })
                    } catch (e) {
                      console.error(e)
                      qrs[i] = ''
                    }
                  }
                  setRefereeQrs(qrs)
                  setShowInvite(true)
                }}
                className="flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-white"
              >
                <QrCode className="h-3 w-3" /> QR
              </button>
              <button
                onClick={() => setState(prev => ({ ...prev, isTestMode: !prev.isTestMode, timerRunning: prev.isTestMode ? prev.timerRunning : false }))}
                className={`rounded-md border px-2 py-1 text-[11px] font-medium ${state.isTestMode ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-700 border-app-border'}`}
              >
                Test {state.isTestMode ? 'Açık' : 'Kapalı'}
              </button>
              <button onClick={() => setShowSettings(true)} className="rounded-md border border-app-border bg-white px-2 py-1 text-[11px] font-medium text-slate-700">
                <Settings className="h-3 w-3" />
              </button>
              <button onClick={newMatch} className="rounded-md border border-app-border bg-white px-2 py-1 text-[11px] font-medium text-slate-700">
                Yeni
              </button>
            </>
          )}
        </div>
      </div>

      {/* Skorboard Paneli */}
      <div className="flex flex-1 flex-col gap-1 p-1">
        <div className="flex flex-1 gap-1">
          {/* Kırmızı Skorboard */}
          <div className="relative flex flex-[2] md:flex-[1] flex-col rounded-xl bg-red-600 px-2 py-2 text-center text-white shadow-lg border-b-4 border-red-800">
            <div className="absolute left-1 inset-y-2 flex flex-col justify-between py-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`h-4 w-4 md:h-6 md:w-6 rounded-full border ${i < state.stats[2].gamjeom ? 'bg-amber-400 border-amber-600' : 'bg-red-900/40 border-red-900/50'}`} />
              ))}
            </div>
            <p className="text-[10px] md:text-sm font-bold uppercase tracking-wider text-red-200">Kırmızı</p>
            <p className="truncate text-[10px] md:text-lg font-semibold text-white">
              {state.athlete2 ? `${state.athlete2.first_name}` : '—'}
            </p>
            <p className="my-auto text-6xl md:text-[10rem] font-black leading-none text-white drop-shadow-xl">{state.score[2]}</p>
            <p className="text-xs md:text-lg font-bold text-red-100">Raunt: {state.roundWins[2]}</p>
          </div>
          {/* Mavi Skorboard */}
          <div className="relative flex flex-[2] md:flex-[1] flex-col rounded-xl bg-blue-600 px-2 py-2 text-center text-white shadow-lg border-b-4 border-blue-800">
            <div className="absolute right-1 inset-y-2 flex flex-col justify-between py-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`h-4 w-4 md:h-6 md:w-6 rounded-full border ${i < state.stats[1].gamjeom ? 'bg-amber-400 border-amber-600' : 'bg-blue-900/40 border-blue-900/50'}`} />
              ))}
            </div>
            <p className="text-[10px] md:text-sm font-bold uppercase tracking-wider text-blue-200">Mavi</p>
            <p className="truncate text-[10px] md:text-lg font-semibold text-white">
              {state.athlete1 ? `${state.athlete1.first_name}` : '—'}
            </p>
            <p className="my-auto text-6xl md:text-[10rem] font-black leading-none text-white drop-shadow-xl">{state.score[1]}</p>
            <p className="text-xs md:text-lg font-bold text-blue-100">Raunt: {state.roundWins[1]}</p>
          </div>
        </div>
        
        {/* Merkez Zamanlayıcı */}
        <div className="flex flex-col items-center justify-center rounded-lg bg-slate-900 py-0.5 text-white shadow">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
            {phaseLabel} • {Math.min(state.currentRound, 3)}/3
          </p>
          <p className={`font-mono text-3xl font-black leading-none ${
            state.timerSec <= 10 && state.phase === 'round' && state.timerRunning ? 'text-red-400' : 'text-white'
          }`}>
            {mm}:{ss}
          </p>
        </div>
      </div>

      {/* Sporcu seçimi + Hakem sayısı (admin idle durumda) */}
      {isAdmin && (state.phase === 'idle' || state.phase === 'finished') && (
        <div className="mx-2 mt-2 grid gap-2 sm:grid-cols-2">
          <AthleteSelect
            label="Kırmızı Sporcu"
            color="red"
            athletes={athletes}
            value={state.athlete2}
            onChange={(a) => setAthlete(2, a)}
          />
          <AthleteSelect
            label="Mavi Sporcu"
            color="blue"
            athletes={athletes}
            value={state.athlete1}
            onChange={(a) => setAthlete(1, a)}
          />
        </div>
      )}

      {/* Hakem UI (ref mode) - Optimize Edilmiş Thumb Zone */}
      {isReferee && (
        <div className="flex flex-col flex-[2] bg-slate-50 touch-none select-none overflow-hidden pb-[env(safe-area-inset-bottom)]">
          {/* Puanlama Alanı - Büyütülmüş */}
          <div className="flex-1 grid grid-cols-2 gap-2 p-2 pb-10 overflow-hidden">
            <div className={`flex flex-col gap-2 ${state.phase === 'round' || state.isTestMode ? 'bg-red-50' : 'bg-slate-50'}`}>
              <RefereeScoreButtons
                isReferee={isReferee}
                side={2}
                disabled={!(state.phase === 'round' || state.isTestMode)}
                onScore={broadcastVote}
              />
            </div>
            <div className={`flex flex-col gap-2 ${state.phase === 'round' || state.isTestMode ? 'bg-blue-50' : 'bg-slate-50'}`}>
              <RefereeScoreButtons
                isReferee={isReferee}
                side={1}
                disabled={!(state.phase === 'round' || state.isTestMode)}
                onScore={broadcastVote}
              />
            </div>
          </div>
        </div>
      )}

      {/* Hakem Test Paneli (Admin) */}
      {isAdmin && state.isTestMode && (
        <div className="mx-2 mt-2 grid grid-cols-3 gap-2 p-2 rounded-lg bg-amber-100 border border-amber-300">
          {[1, 2, 3].map(r => {
            const sig = state.testSignals[r]
            const colorClass = sig?.side === 1 ? 'text-blue-600' : sig?.side === 2 ? 'text-red-600' : 'text-amber-600'
            return (
              <div key={r} className="text-center">
                <div className="text-[10px] font-bold text-amber-800">Hakem #{r}</div>
                <div className={`mt-1 h-8 flex items-center justify-center bg-white rounded border border-amber-200 text-[10px] font-bold uppercase ${colorClass}`}>
                  {sig ? `${sig.action}` : '...'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Admin Puanlama ve Bekleyen Oylar */}
      {isAdmin && !state.isTestMode && Object.values(state.refereeStatus).filter(r => r.connected).length > 1 && state.pendingVotes.filter(v => Date.now() - v.ts <= state.voteToleranceMs).length > 0 && (
        <div className="mx-2 mt-2 z-10 flex flex-wrap gap-1 rounded-lg bg-amber-50 p-2 border border-amber-200">
          <span className="text-[10px] font-bold text-amber-700 w-full mb-1 uppercase">Bekleyen Oylar:</span>
          {state.pendingVotes
            .filter(v => Date.now() - v.ts <= state.voteToleranceMs)
            .map((v, i) => (
              <div key={i} className={`text-[10px] px-1.5 py-0.5 rounded border ${v.side === 1 ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-red-100 border-red-200 text-red-700'}`}>
                H#{v.refId}: {v.delta > 0 ? `+${v.delta}` : v.delta}
              </div>
            ))}
        </div>
      )}

      {/* Admin/Referee UI - Ana puan butonları */}
      {(isAdmin || !isReferee) && (
        <div className="flex flex-[5] flex-col px-2 pb-1 overflow-hidden min-h-0">
          <div className="grid grid-cols-2 gap-2 h-full overflow-hidden min-h-0">
            {/* Kırmızı Bölge */}
            <div className="grid grid-cols-2 grid-rows-3 gap-2 overflow-hidden min-h-0">
              <ScoreButtons
                color="red"
                isAdmin={isAdmin}
                disabled={!canControl || state.phase !== 'round'}
                stats={state.stats[2]}
                score={state.score[2]}
                onScore={(delta, key) => {
                  setScore(2, delta, key)
                }}
                onGamJeom={() => addGamJeom(2)}
              />
            </div>
            {/* Mavi Bölge */}
            <div className="grid grid-cols-2 grid-rows-3 gap-2 overflow-hidden min-h-0">
              <ScoreButtons
                color="blue"
                isAdmin={isAdmin}
                disabled={!canControl || state.phase !== 'round'}
                stats={state.stats[1]}
                score={state.score[1]}
                onScore={(delta, key) => {
                  setScore(1, delta, key)
                }}
                onGamJeom={() => addGamJeom(1)}
              />
            </div>
          </div>
          {/* Geçmiş Raunt Skorları - Yeni Tasarım */}
          {isAdmin && (
            <div className="mt-auto pt-2 grid grid-cols-3 gap-2">
              {[1, 2, 3].map(roundNum => (
                <RoundScoreDisplay
                  key={roundNum}
                  roundNum={roundNum}
                  scores={state.roundScores[roundNum]}
                  winner={state.roundWinners[roundNum]}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alt kontrol bar - Sadece Admin için */}
      {isAdmin && (
        <div className="flex flex-none flex-wrap items-center justify-center gap-1.5 border-t border-app-border bg-white/80 px-2 py-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
          {state.phase === 'idle' ? (
            <button
              onClick={startMatch}
              disabled={!canControl}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-lg active:scale-95 disabled:opacity-50"
            >
              <Play className="h-4 w-4" /> BAŞLAT
            </button>
          ) : state.phase === 'finished' ? (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">
                <Trophy className="h-4 w-4" />
                {state.winner === 1 ? 'MAVİ' : 'KIRMIZI'} KAZANDI {state.matchEndReason ? `(${state.matchEndReason})` : ''}
              </div>
              <button onClick={resetMatch} className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Sıfırla</button>
            </div>
          ) : (
            <>
              <button
                onClick={pauseToggle}
                className="flex flex-1 min-w-[80px] items-center justify-center gap-1 rounded-lg bg-slate-700 py-2.5 text-[11px] font-bold text-white active:scale-95"
              >
                {state.timerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {state.timerRunning ? 'DURDUR' : 'DEVAM'}
              </button>

              {state.phase === 'break' && (
                <button
                  onClick={skipBreak}
                  className="flex flex-1 min-w-[80px] items-center justify-center rounded-lg border-2 border-slate-700 bg-white py-2.5 text-[11px] font-bold text-slate-700 active:scale-95"
                >
                  ARA BİTİR
                </button>
              )}

              <button
                onClick={undoLastAction}
                disabled={state.history.length === 0}
                className="flex flex-1 min-w-[80px] items-center justify-center gap-1 rounded-lg border-2 border-amber-500 bg-amber-50 py-2.5 text-[11px] font-bold text-amber-700 active:scale-95 disabled:opacity-30"
              >
                <RotateCcw className="h-3.5 w-3.5" /> GERİ ({state.history.length})
              </button>

              <button
                onClick={() => handleRoundEnd(false)}
                disabled={state.phase !== 'round' || state.timerRunning}
                className="flex flex-1 min-w-[80px] items-center justify-center rounded-lg border-2 border-slate-700 bg-white py-2.5 text-[11px] font-bold text-slate-700 active:scale-95 disabled:opacity-30"
              >
                RAUNT BİTİR
              </button>

              <button
                onClick={() => setShowEndMatchModal(true)}
                className="flex flex-1 min-w-[80px] items-center justify-center gap-1 rounded-lg bg-red-500 py-2.5 text-[11px] font-bold text-white shadow-md active:scale-95"
              >
                <Trophy className="h-3.5 w-3.5" /> MAÇ BİTİR
              </button>

              <button
                onClick={resetMatch}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 active:scale-95"
                title="Sıfırla"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Maçı Bitir Modalı */}
      {showEndMatchModal && (
        <Modal onClose={() => setShowEndMatchModal(false)} title="Maçı Bitir">
          <p className="text-sm text-slate-600 mb-4">Maçı bitirme nedenini seçin ve galibi belirleyin.</p>
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-500">Bitiş Nedeni</label>
            <select
              value={endMatchReason}
              onChange={(e) => setEndMatchReason(e.target.value)}
              className="w-full rounded-lg border border-app-border p-2 text-sm"
            >
              <option value="Antrenör Çekildi">Antrenör Çekildi</option>
              <option value="KO">KO (Nakavt)</option>
              <option value="Hakem Kararı">Hakem Kararı</option>
              <option value="Diğer">Diğer</option>
            </select>
            <label className="block text-xs font-medium text-slate-500 mt-4">Maçın Galibi</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setEndMatchWinner(2)}
                className={`rounded-lg border-2 px-4 py-3 text-sm font-semibold ${endMatchWinner === 2 ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                Kırmızı {state.athlete2?.first_name}
              </button>
              <button
                onClick={() => setEndMatchWinner(1)}
                className={`rounded-lg border-2 px-4 py-3 text-sm font-semibold ${endMatchWinner === 1 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                Mavi {state.athlete1?.first_name}
              </button>
            </div>
            {endMatchWinner && (
              <button onClick={confirmEndMatch} className="btn-primary w-full mt-4">
                Maçı Bitir ve Kaydet
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Hakem popup (raunt sonu beraberlik) */}
      {refereeOpen && (
        <Modal onClose={() => setRefereeOpen(false)} title="Hakem Kararı (Beraberlik)">
          <p className="text-sm text-slate-600">
            Tüm kriterler eşit. Rauntun galibini manuel seçin.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => confirmRefereeWinner(2)}
              className="rounded-xl border-2 border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              Kırmızı Kazandı
            </button>
            <button
              onClick={() => confirmRefereeWinner(1)}
              className="rounded-xl border-2 border-blue-500 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Mavi Kazandı
            </button>
          </div>
        </Modal>
      )}

      {/* Beraberlik Oylama Modalı (Hakemler ve Admin için) */}
      {(state.tieVoteActive && (isReferee || isAdmin)) && (
        <TieVoteModal
          key={state.currentRound} // Raunt değiştiğinde yeniden render et
          activeRefCount={activeRefCount}
          isAdmin={isAdmin}
          isReferee={isReferee}
          urlRef={urlRef}
          refereeTieVotes={state.refereeTieVotes}
          onVote={(side) => {
            if (isAdmin) { // Admin oy kullanırsa doğrudan state'i güncelle
              setState(prev => ({
                ...prev,
                refereeTieVotes: { ...prev.refereeTieVotes, [side]: prev.refereeTieVotes[side] + 1 }
              }))
            } else { // Hakem oy kullanırsa broadcast ile gönder
              const ch = channelRef.current
              if (ch) void ch.send({
                type: 'broadcast',
                event: 'tie_vote',
                payload: { side, matchSessionId: state.matchSessionId, round: state.currentRound }
              })
            }
          }}
          onFinalize={(winner) => { // Oylama sonucu admin tarafından belirlendiğinde
            setState(prev => {
              const next = finalizeRound(prev, winner, 'Hakem/Admin Kararı (Beraberlik)')
              next.refereeWinner = winner
              return { ...next, tieVoteActive: false, refereeTieVotes: { 1: 0, 2: 0 } }
            })
          }}
          matchSessionId={state.matchSessionId}
          currentRound={state.currentRound}
        />
      )}

      {/* Raunt Sonu Kazanan Popup Bildirimi */}
      {roundWinnerPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRoundWinnerPopup(null)}>
          <div className={`w-full max-w-sm rounded-2xl p-6 text-center text-white shadow-2xl ${roundWinnerPopup.winner === 2 ? 'bg-red-600 border-4 border-red-400' : 'bg-blue-600 border-4 border-blue-400'}`} onClick={(e) => e.stopPropagation()}>
            <Trophy className="mx-auto h-12 w-12 animate-bounce mb-2" />
            <h2 className="text-xl font-black uppercase tracking-wider">RAUNT BİTTİ</h2>
            <div className="mt-3 rounded-xl bg-white/10 p-3 backdrop-blur">
              <p className="text-xs font-bold uppercase opacity-80">{roundWinnerPopup.winner === 2 ? 'Kırmızı Köşe' : 'Mavi Köşe'}</p>
              <p className="text-2xl font-extrabold mt-0.5">
                {roundWinnerPopup.winner === 2 ? (state.athlete2 ? `${state.athlete2.first_name} ${state.athlete2.last_name}` : 'Kırmızı Sporcu') : (state.athlete1 ? `${state.athlete1.first_name} ${state.athlete1.last_name}` : 'Mavi Sporcu')}
              </p>
            </div>
            {roundWinnerPopup.method && (
              <p className="mt-2 text-xs font-medium opacity-90">Kazanma Şekli: {roundWinnerPopup.method}</p>
            )}
            <button
              onClick={() => setRoundWinnerPopup(null)}
              className="mt-5 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow hover:bg-slate-100"
            >
              Tamam / Devam Et
            </button>
          </div>
        </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={`w-full max-w-sm rounded-3xl p-8 text-center text-white shadow-2xl border-8 ${state.winner === 2 ? 'bg-red-600 border-red-400' : 'bg-blue-600 border-blue-400'}`}>
            <Trophy className="mx-auto h-20 w-20 animate-pulse mb-4" />
            <h2 className="text-3xl font-black uppercase tracking-tighter">MAÇ BİTTİ</h2>
            <div className="mt-6 rounded-2xl bg-white/20 p-6 backdrop-blur">
              <p className="text-sm font-bold uppercase opacity-80">ŞAMPİYON</p>
              <p className="text-4xl font-black mt-2">
                {state.winner === 2 ? (state.athlete2 ? `${state.athlete2.first_name} ${state.athlete2.last_name}` : 'Kırmızı') : (state.athlete1 ? `${state.athlete1.first_name} ${state.athlete1.last_name}` : 'Mavi')}
              </p>
            </div>
            {state.refereeWinner && <p className="mt-4 text-sm font-bold opacity-75">Hakem Kararı İle</p>}
              {isAdmin && (
                <div className="mt-8 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={(e) => newMatch(e, true)}
                    className="rounded-2xl bg-white px-4 py-4 font-black text-slate-800 shadow-xl hover:bg-slate-100 text-xs"
                  >
                    AYNI SPORCULAR
                  </button>
                  <button
                    type="button"
                    onClick={(e) => newMatch(e, false)}
                    className="rounded-2xl bg-slate-800 px-4 py-4 font-black text-white shadow-xl hover:bg-slate-900 text-xs"
                  >
                    YENİ MAÇ
                  </button>
                </div>
              )}
          </div>
        </div>
      )}

      {/* QR Modal - en üstte (z-50) */}
      {showSettings && (
        <Modal onClose={() => setShowSettings(false)} title="Maç Ayarları">
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Raunt Süresi (sn)</label>
              <input type="number" value={state.roundDurationSec} onChange={(e) => {
                const v = parseInt(e.target.value) || 0
                setRoundDuration(v)
              }} className="w-full rounded-lg border border-app-border p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Ara Süresi (sn)</label>
              <input type="number" value={state.breakDurationSec} onChange={(e) => {
                const v = parseInt(e.target.value) || 0
                setBreakDuration(v)
              }} className="w-full rounded-lg border border-app-border p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Puan Farkı Limiti</label>
              <input type="number" value={state.gapMatchScore} onChange={(e) => {
                const v = parseInt(e.target.value) || 0
                setGapScore(v)
              }} className="w-full rounded-lg border border-app-border p-2 text-sm" />
            </div>
            <button onClick={() => { broadcast(state); setShowSettings(false) }} className="w-full rounded-lg bg-emerald-600 text-white py-2 font-bold text-sm">
              Kaydet ve Yayınla
            </button>
          </div>
        </Modal>
      )}

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowInvite(false)}>
          <div className="glass-panel rounded-2xl bg-white p-5 max-w-xs w-full text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Hakem Davet QR Kodları</h3>
              <button onClick={() => setShowInvite(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((refNum) => {
                const refUrl = `${window.location.origin}/canli-skor?matchId=${matchId}&ref=${refNum}`
                return (
                  <div key={refNum} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-left">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700">Hakem #{refNum}</span>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(refUrl)
                          } catch {
                            const ta = document.createElement('textarea')
                            ta.value = refUrl
                            document.body.appendChild(ta)
                            ta.select()
                            document.execCommand('copy')
                            document.body.removeChild(ta)
                          }
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Kopyala
                      </button>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <img
                        src={refereeQrs[refNum]}
                        alt={`Hakem ${refNum} QR`}
                        className="h-24 w-24"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-brand-muted">Her hakem için ayrı QR kodu. Hakem tarayıp bağlandığında panelde 'Bağlı' gösterecek.</p>
            <button
              onClick={() => setShowInvite(false)}
              className="mt-3 w-full rounded-lg border border-app-border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-app-bg-soft"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Yeni Raunt Skor Gösterimi Bileşeni ────────────────────

function RoundScoreDisplay({ roundNum, scores, winner }: {
  roundNum: number
  scores?: Record<Side, number>
  winner?: Side | 'draw' | 'ref'
}) {
  const hasScores = !!scores
  
  return (
    <div className="flex flex-col items-center group relative">
      <span className="mb-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">{roundNum}. RAUNT</span>
      {isAdmin && winner && (
        <button
          onClick={() => (window as any).editRound(roundNum)}
          className="absolute -top-1 -right-1 z-10 rounded-full bg-slate-800 p-1 text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          title="Raunt Düzenle"
        >
          <Settings2 className="h-3 w-3" />
        </button>
      )}
      <div className="flex h-16 w-full items-stretch gap-1">
        {/* Kırmızı Taraf */}
        <div className={`flex flex-1 items-center justify-center rounded-l-xl border-y-2 border-l-2 transition-all shadow-sm ${winner === 2 ? 'bg-red-600 border-red-700 text-white' : 'bg-white border-red-200 text-red-600'}`}>
          <span className="text-2xl font-black">{hasScores ? scores[2] : '0'}</span>
        </div>
        
        {/* Mavi Taraf */}
        <div className={`flex flex-1 items-center justify-center rounded-r-xl border-y-2 border-r-2 transition-all shadow-sm ${winner === 1 ? 'bg-blue-600 border-blue-700 text-white' : 'bg-white border-blue-200 text-blue-600'}`}>
          <span className="text-2xl font-black">{hasScores ? scores[1] : '0'}</span>
        </div>
      </div>
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
  score: _score,
  onScore,
  onGamJeom,
}: {
  color: 'blue' | 'red'
  isAdmin: boolean
  disabled: boolean
  stats: Stats
  score: number
  onScore: (delta: number, statKey?: keyof Stats) => void
  onGamJeom: () => void
}) {
  const isBlue = color === 'blue'
  const btnBase = isBlue
    ? 'bg-blue-600 text-white border-blue-700'
    : 'bg-red-600 text-white border-red-700'
  const gjBase = 'bg-amber-500 text-white border-amber-600'

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
          className={`flex h-full min-h-0 items-center justify-center rounded-xl border-2 ${btnBase} text-xl md:text-2xl font-black shadow active:scale-95 disabled:opacity-40`}
        >
          {label}
        </button>
      ))}
      <button
        disabled={disabled || !isAdmin || stats.gamjeom >= 5}
        onClick={onGamJeom}
        className={`flex h-full min-h-0 items-center justify-center gap-1 rounded-xl border-2 ${gjBase} text-[10px] font-bold shadow active:scale-95 disabled:opacity-40`}
      >
        <AlertTriangle className="h-3.5 w-3.5" /> GAM-JEOM
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

function TieVoteModal({
  activeRefCount,
  isAdmin,
  isReferee,
  urlRef,
  refereeTieVotes,
  onVote,
  onFinalize,
  matchSessionId,
  currentRound,
}: {
  activeRefCount: number
  isAdmin: boolean
  isReferee: boolean
  urlRef: number
  refereeTieVotes: Record<Side, number>
  onVote: (side: Side) => void
  onFinalize: (winner: Side) => void
  matchSessionId: string
  currentRound: number
}) {
  const [hasVoted, setHasVoted] = useState(false)
  const isAdminAlsoVoting = activeRefCount === 2
  const totalVotesPossible = isAdminAlsoVoting ? 3 : activeRefCount
  const blueVotes = refereeTieVotes[1] || 0
  const redVotes = refereeTieVotes[2] || 0
  const totalVotesCast = blueVotes + redVotes

  // Çoğunluk kontrolü
  useEffect(() => {
    if (!isAdmin) return
    const required = Math.ceil((totalVotesPossible + 0.1) / 2) // 1/1->1, 2/3->2, 3/3->2
    if (blueVotes >= required) onFinalize(1)
    else if (redVotes >= required) onFinalize(2)
  }, [blueVotes, redVotes, isAdmin, totalVotesPossible, onFinalize])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border-4 border-slate-200" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-center text-xl font-black uppercase tracking-tight text-slate-800">BERABERLİK KARARI</h2>
        <p className="mt-2 text-center text-xs font-medium text-slate-500 uppercase">
          Raunt {currentRound} • Hakem Kararı Bekleniyor
        </p>

        {/* Oylama Durumu (Sadece Admin veya Oy Veren Hakem için) */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center text-3xl font-black shadow-inner ${blueVotes > 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-300'}`}>
              {blueVotes}
            </div>
            <span className="text-[10px] font-bold text-blue-700">MAVİ OY</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center text-3xl font-black shadow-inner ${redVotes > 0 ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-300'}`}>
              {redVotes}
            </div>
            <span className="text-[10px] font-bold text-red-700">KIRMIZI OY</span>
          </div>
        </div>

        <div className="mt-4 text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Toplam Oy: {totalVotesCast} / {totalVotesPossible}
          </span>
        </div>

        {/* Oy Verme Butonları (Hakem veya Admin-eğer 2 hakem varsa-) */}
        {((isReferee && !hasVoted) || (isAdmin && isAdminAlsoVoting && !hasVoted)) ? (
          <div className="mt-8 grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                onVote(2)
                setHasVoted(true)
              }}
              style={{ minHeight: '48px', userSelect: 'none', WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
              className="rounded-2xl bg-red-600 py-4 text-sm font-black text-white shadow-lg active:scale-95 transition-transform"
            >
              KIRMIZI
            </button>
            <button
              onClick={() => {
                onVote(1)
                setHasVoted(true)
              }}
              style={{ minHeight: '48px', userSelect: 'none', WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
              className="rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-lg active:scale-95 transition-transform"
            >
              MAVİ
            </button>
          </div>
        ) : (
          <div className="mt-8 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-100 text-center">
            <p className="text-sm font-bold text-emerald-700">
              {hasVoted ? 'Oyunuz Kaydedildi' : 'Oylama Bekleniyor...'}
            </p>
            <p className="text-[10px] text-emerald-600 mt-1 uppercase">Lütfen Bekleyin</p>
          </div>
        )}
      </div>
    </div>
  )
}