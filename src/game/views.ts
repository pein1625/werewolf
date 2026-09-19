import type { DeathCause, GameState, Phase, SeerResult, Winner } from './events'
import { DEATH_CAUSE_LABEL } from './events'
import type { Role, RoleId } from './roles'
import { ROLES, isWolf } from './roles'
import type { Step } from './script'
import { buildScript, currentStep } from './script'

export type TimerView = {
  phase: Phase
  durationSec: number
  remainingSec: number
  running: boolean
  expired: boolean
}

export type PublicPlayer = {
  id: string
  name: string
  seat: number
  alive: boolean
  connected: boolean
  isYou: boolean
  roleId: RoleId | null
  roleName: string | null
  deathCause: DeathCause | null
  deathCauseLabel: string | null
  deathRound: number | null
}

export type RevealRow = {
  name: string
  seat: number
  roleName: string | null
  team: 'VILLAGE' | 'WOLF' | null
  alive: boolean
  deathCauseLabel: string | null
}

export type PlayerView = {
  kind: 'player'
  code: string
  phase: Phase
  round: number
  winner: Winner | null
  you: {
    id: string
    name: string
    seat: number
    alive: boolean
    roleId: RoleId | null
    role: Role | null
    isLover: boolean
    loverName: string | null
    deathCause: DeathCause | null
    deathCauseLabel: string | null
  }
  allies: { id: string; name: string; roleName: string }[]
  elderBitten: boolean
  playerCount: number
  lobbyNames: string[]
  reveal: RevealRow[]
}

export type HostView = {
  kind: 'host'
  code: string
  phase: Phase
  round: number
  winner: Winner | null
  timer: TimerView | null
  timers: GameState['timers']
  roleCounts: GameState['roleCounts']
  players: (PublicPlayer & { isLover: boolean; converted: boolean })[]
  deaths: (GameState['deaths'][number] & { name: string; causeLabel: string })[]
  pendingNight: GameState['pendingNight']
  pendingHunterId: string | null
  pendingHunterName: string | null
  witchHealUsed: boolean
  witchPoisonUsed: boolean
  alphaConvertUsed: boolean
  elderBitten: boolean
  guardLastTarget: string | null
  seerResults: (SeerResult & { targetName: string; actorName: string | null })[]
  step: Step | null
  stepIndex: number
  stepCount: number
  canUndo: boolean
  eventCount: number
  aliveCount: number
  wolvesAlive: number
}

function nameOf(state: GameState, id: string | null | undefined): string {
  if (!id) return '—'
  return state.players.find((p) => p.id === id)?.name ?? '—'
}

function lastDeath(state: GameState, playerId: string) {
  for (let i = state.deaths.length - 1; i >= 0; i--) {
    if (state.deaths[i].playerId === playerId) return state.deaths[i]
  }
  return null
}

export function buildPlayerView(state: GameState, playerId: string): PlayerView {
  const me = state.players.find((p) => p.id === playerId)
  const myDeath = me ? lastDeath(state, me.id) : null

  const allies =
    me?.roleId && isWolf(me.roleId)
      ? state.players
          .filter((p) => p.id !== playerId && p.roleId && isWolf(p.roleId))
          .map((p) => ({ id: p.id, name: p.name, roleName: ROLES[p.roleId as RoleId].name }))
      : []

  let loverName: string | null = null
  if (me?.isLover && state.lovers) {
    const otherId = state.lovers.find((x) => x !== playerId)
    if (otherId) loverName = nameOf(state, otherId)
  }

  const reveal: RevealRow[] =
    state.phase === 'ENDED'
      ? state.players.map((p) => {
          const death = p.alive ? null : lastDeath(state, p.id)
          return {
            name: p.name,
            seat: p.seat,
            roleName: p.roleId ? ROLES[p.roleId].name : null,
            team: p.roleId ? ROLES[p.roleId].team : null,
            alive: p.alive,
            deathCauseLabel: death ? DEATH_CAUSE_LABEL[death.cause] : null,
          }
        })
      : []

  return {
    kind: 'player',
    code: state.code,
    phase: state.phase,
    round: state.round,
    winner: state.winner,
    you: {
      id: playerId,
      name: me?.name ?? '',
      seat: me?.seat ?? 0,
      alive: me?.alive ?? true,
      roleId: me?.roleId ?? null,
      role: me?.roleId ? ROLES[me.roleId] : null,
      isLover: me?.isLover ?? false,
      loverName,
      deathCause: myDeath?.cause ?? null,
      deathCauseLabel: myDeath ? DEATH_CAUSE_LABEL[myDeath.cause] : null,
    },
    allies,
    elderBitten: me?.roleId === 'elder' ? state.elderBitten : false,
    playerCount: state.players.length,
    lobbyNames: state.phase === 'LOBBY' ? state.players.map((p) => p.name) : [],
    reveal,
  }
}

export function buildHostView(state: GameState, timer: TimerView | null, canUndo: boolean): HostView {
  const players = state.players.map((p) => {
    const death = p.alive ? null : lastDeath(state, p.id)
    return {
      id: p.id,
      name: p.name,
      seat: p.seat,
      alive: p.alive,
      connected: p.connected,
      isYou: false,
      roleId: p.roleId,
      roleName: p.roleId ? ROLES[p.roleId].name : null,
      deathCause: death?.cause ?? null,
      deathCauseLabel: death ? DEATH_CAUSE_LABEL[death.cause] : null,
      deathRound: death?.round ?? null,
      isLover: p.isLover,
      converted: p.converted,
    }
  })

  const aliveList = state.players.filter((p) => p.alive)
  const script = buildScript(state)

  return {
    kind: 'host',
    code: state.code,
    phase: state.phase,
    round: state.round,
    winner: state.winner,
    timer,
    timers: state.timers,
    roleCounts: state.roleCounts,
    players,
    deaths: state.deaths.map((d) => ({
      ...d,
      name: nameOf(state, d.playerId),
      causeLabel: DEATH_CAUSE_LABEL[d.cause],
    })),
    pendingNight: state.pendingNight,
    pendingHunterId: state.pendingHunterId,
    pendingHunterName: state.pendingHunterId ? nameOf(state, state.pendingHunterId) : null,
    witchHealUsed: state.witchHealUsed,
    witchPoisonUsed: state.witchPoisonUsed,
    alphaConvertUsed: state.alphaConvertUsed,
    elderBitten: state.elderBitten,
    guardLastTarget: state.guardLastTarget,
    seerResults: state.seerResults.map((r) => ({
      ...r,
      targetName: nameOf(state, r.targetId),
      actorName: r.actorId ? nameOf(state, r.actorId) : null,
    })),
    step: currentStep(state),
    stepIndex: Math.min(state.stepIndex, Math.max(0, script.length - 1)),
    stepCount: script.length,
    canUndo,
    eventCount: state.eventCount,
    aliveCount: aliveList.length,
    wolvesAlive: aliveList.filter((p) => p.roleId && isWolf(p.roleId)).length,
  }
}
