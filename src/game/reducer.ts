import { DEFAULT_TIMERS, emptyNight } from './events'
import type { Death, DeathCause, GameEvent, GameState, Player, Winner } from './events'
import { isWolf } from './roles'
import type { RoleId } from './roles'

export function initialState(code: string): GameState {
  return {
    code,
    phase: 'LOBBY',
    round: 0,
    players: [],
    roleCounts: {},
    timers: { ...DEFAULT_TIMERS },
    deaths: [],
    lovers: null,
    witchHealUsed: false,
    witchPoisonUsed: false,
    alphaConvertUsed: false,
    elderBitten: false,
    guardLastTarget: null,
    seerResults: [],
    pendingHunterId: null,
    pendingNight: emptyNight(),
    stepIndex: 0,
    winner: null,
    eventCount: 0,
  }
}

function find(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id)
}

function kill(state: GameState, id: string, cause: DeathCause, at: number, byPlayerId?: string): void {
  const player = find(state, id)
  if (!player || !player.alive) return
  player.alive = false
  const death: Death = { playerId: id, cause, round: state.round, phase: state.phase, at }
  if (byPlayerId) death.byPlayerId = byPlayerId
  state.deaths.push(death)
  if (player.roleId === 'hunter') state.pendingHunterId = id
  if (state.lovers && state.lovers.includes(id)) {
    const other = state.lovers.find((x) => x !== id)
    if (other) kill(state, other, 'LOVER', at, id)
  }
}

function holderOf(state: GameState, roleId: RoleId): string | null {
  return state.players.find((p) => p.roleId === roleId)?.id ?? null
}

function detectWinner(state: GameState): Winner | null {
  if (state.phase === 'LOBBY' || state.phase === 'DEALING') return null
  const alive = state.players.filter((p) => p.alive)
  if (alive.length === 0) return 'NOBODY'

  if (state.lovers) {
    const [a, b] = state.lovers
    const pa = find(state, a)
    const pb = find(state, b)
    const crossTeam =
      pa?.roleId && pb?.roleId && isWolf(pa.roleId) !== isWolf(pb.roleId)
    if (alive.length === 2 && pa?.alive && pb?.alive && crossTeam) return 'LOVERS'
  }

  const wolves = alive.filter((p) => p.roleId && isWolf(p.roleId))
  if (wolves.length === 0) return 'VILLAGE'
  if (wolves.length >= alive.length - wolves.length) return 'WOLF'
  return null
}

export function reduce(prev: GameState, event: GameEvent): GameState {
  const state: GameState = structuredClone(prev)
  state.eventCount = prev.eventCount + 1

  switch (event.type) {
    case 'ROOM_CREATED': {
      state.code = event.code
      break
    }

    case 'PLAYER_JOINED': {
      if (!find(state, event.playerId)) {
        state.players.push({
          id: event.playerId,
          name: event.name,
          seat: state.players.length + 1,
          connected: true,
          roleId: null,
          alive: true,
          isLover: false,
          converted: false,
        })
      }
      break
    }

    case 'PLAYER_RENAMED': {
      const p = find(state, event.playerId)
      if (p) p.name = event.name
      break
    }

    case 'PLAYER_REMOVED': {
      state.players = state.players.filter((p) => p.id !== event.playerId)
      state.players.forEach((p, i) => {
        p.seat = i + 1
      })
      break
    }

    case 'SETUP_CHANGED': {
      state.roleCounts = event.roleCounts
      state.timers = event.timers
      break
    }

    case 'ROLES_DEALT': {
      for (const a of event.assignments) {
        const p = find(state, a.playerId)
        if (p) p.roleId = a.roleId
      }
      state.phase = 'DEALING'
      break
    }

    case 'GAME_STARTED': {
      state.phase = 'NIGHT'
      state.round = 1
      state.pendingNight = emptyNight()
      state.stepIndex = 0
      break
    }

    case 'PHASE_CHANGED': {
      state.phase = event.phase
      state.round = event.round
      state.stepIndex = 0
      if (event.phase === 'NIGHT') state.pendingNight = emptyNight()
      break
    }

    case 'NIGHT_ACTION': {
      state.pendingNight[event.action] = event.targetIds
      if (event.action === 'CUPID_LINK' && event.targetIds.length === 2) {
        state.players.forEach((p) => {
          p.isLover = false
        })
        const [a, b] = event.targetIds
        state.lovers = [a, b]
        const pa = find(state, a)
        const pb = find(state, b)
        if (pa) pa.isLover = true
        if (pb) pb.isLover = true
      }
      break
    }

    case 'NIGHT_RESOLVED': {
      const night = state.pendingNight
      const convertTarget = night.ALPHA_CONVERT[0]
      const guardTarget = night.GUARD_PROTECT[0]
      const healTarget = night.WITCH_HEAL[0]
      const poisonTarget = night.WITCH_POISON[0]
      const wolfTarget = night.WOLF_KILL[0]

      if (convertTarget && !state.alphaConvertUsed) {
        const victim = find(state, convertTarget)
        if (victim && victim.alive) {
          victim.roleId = 'werewolf'
          victim.converted = true
          state.alphaConvertUsed = true
        }
      } else if (wolfTarget) {
        const saved = wolfTarget === guardTarget || wolfTarget === healTarget
        const victim = find(state, wolfTarget)
        if (!saved && victim && victim.alive) {
          if (victim.roleId === 'elder' && !state.elderBitten) {
            state.elderBitten = true
          } else {
            kill(state, wolfTarget, 'WOLF', event.at)
          }
        }
      }

      if (healTarget) state.witchHealUsed = true
      if (poisonTarget) {
        state.witchPoisonUsed = true
        kill(state, poisonTarget, 'WITCH_POISON', event.at)
      }

      for (const targetId of night.SEER_INSPECT) {
        const t = find(state, targetId)
        state.seerResults.push({
          round: state.round,
          actorId: holderOf(state, 'seer'),
          targetId,
          roleId: null,
          isWolf: !!t?.roleId && isWolf(t.roleId),
          precise: false,
        })
      }
      for (const targetId of night.WOLF_SEER_INSPECT) {
        const t = find(state, targetId)
        state.seerResults.push({
          round: state.round,
          actorId: holderOf(state, 'wolf_seer'),
          targetId,
          roleId: t?.roleId ?? null,
          isWolf: !!t?.roleId && isWolf(t.roleId),
          precise: true,
        })
      }

      state.guardLastTarget = guardTarget ?? null
      state.pendingNight = emptyNight()
      break
    }

    case 'LYNCH': {
      if (event.targetId) kill(state, event.targetId, 'LYNCH', event.at)
      break
    }

    case 'HUNTER_SHOT': {
      if (state.pendingHunterId === event.hunterId) state.pendingHunterId = null
      kill(state, event.targetId, 'HUNTER', event.at, event.hunterId)
      break
    }

    case 'MANUAL_DEATH': {
      kill(state, event.playerId, 'MANUAL', event.at)
      break
    }

    case 'MANUAL_REVIVE': {
      const p = find(state, event.playerId)
      if (p) {
        p.alive = true
        const idx = [...state.deaths].reverse().findIndex((d) => d.playerId === event.playerId)
        if (idx >= 0) state.deaths.splice(state.deaths.length - 1 - idx, 1)
        if (state.pendingHunterId === event.playerId) state.pendingHunterId = null
      }
      break
    }

    case 'STEP_SET': {
      state.stepIndex = Math.max(0, event.index)
      break
    }

    case 'GAME_ENDED': {
      state.phase = 'ENDED'
      state.winner = event.winner
      break
    }
  }

  if (state.phase !== 'ENDED') state.winner = detectWinner(state)
  return state
}

export function foldEvents(code: string, events: GameEvent[]): GameState {
  return events.reduce(reduce, initialState(code))
}
