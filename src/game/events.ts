import type { NightActionKind, RoleId, Team } from './roles'

export type Phase =
  | 'LOBBY'
  | 'DEALING'
  | 'NIGHT'
  | 'DAY_REVEAL'
  | 'DAY_DISCUSS'
  | 'DAY_VOTE'
  | 'ENDED'

export type DeathCause =
  | 'WOLF'
  | 'WITCH_POISON'
  | 'LYNCH'
  | 'HUNTER'
  | 'LOVER'
  | 'MANUAL'

export const DEATH_CAUSE_LABEL: Record<DeathCause, string> = {
  WOLF: 'Bị sói cắn',
  WITCH_POISON: 'Trúng độc Phù thủy',
  LYNCH: 'Bị dân làng treo cổ',
  HUNTER: 'Bị Thợ săn bắn',
  LOVER: 'Chết theo người yêu',
  MANUAL: 'Quản trò xử lý tay',
}

export type Death = {
  playerId: string
  cause: DeathCause
  round: number
  phase: Phase
  byPlayerId?: string
  at: number
}

export type TimerConfig = {
  NIGHT: number
  DAY_REVEAL: number
  DAY_DISCUSS: number
  DAY_VOTE: number
}

export const DEFAULT_TIMERS: TimerConfig = {
  NIGHT: 90,
  DAY_REVEAL: 30,
  DAY_DISCUSS: 180,
  DAY_VOTE: 60,
}

export type GameEvent =
  | { type: 'ROOM_CREATED'; at: number; code: string }
  | { type: 'PLAYER_JOINED'; at: number; playerId: string; name: string }
  | { type: 'PLAYER_RENAMED'; at: number; playerId: string; name: string }
  | { type: 'PLAYER_REMOVED'; at: number; playerId: string }
  | { type: 'SETUP_CHANGED'; at: number; roleCounts: Partial<Record<RoleId, number>>; timers: TimerConfig }
  | { type: 'ROLES_DEALT'; at: number; assignments: { playerId: string; roleId: RoleId }[] }
  | { type: 'GAME_STARTED'; at: number }
  | { type: 'PHASE_CHANGED'; at: number; phase: Phase; round: number }
  | {
      type: 'NIGHT_ACTION'
      at: number
      round: number
      action: NightActionKind
      actorId: string | null
      targetIds: string[]
    }
  | { type: 'NIGHT_RESOLVED'; at: number; round: number }
  | { type: 'LYNCH'; at: number; round: number; targetId: string | null }
  | { type: 'HUNTER_SHOT'; at: number; round: number; hunterId: string; targetId: string }
  | { type: 'MANUAL_DEATH'; at: number; round: number; playerId: string }
  | { type: 'MANUAL_REVIVE'; at: number; round: number; playerId: string }
  | { type: 'STEP_SET'; at: number; index: number }
  | { type: 'GAME_ENDED'; at: number; winner: Winner }

export type Winner = Team | 'LOVERS' | 'NOBODY'

export type Player = {
  id: string
  name: string
  seat: number
  connected: boolean
  roleId: RoleId | null
  alive: boolean
  isLover: boolean
  converted: boolean
}

export type SeerResult = {
  round: number
  actorId: string | null
  targetId: string
  roleId: RoleId | null
  isWolf: boolean
  precise: boolean
}

export type GameState = {
  code: string
  phase: Phase
  round: number
  players: Player[]
  roleCounts: Partial<Record<RoleId, number>>
  timers: TimerConfig
  deaths: Death[]
  lovers: [string, string] | null
  witchHealUsed: boolean
  witchPoisonUsed: boolean
  alphaConvertUsed: boolean
  elderBitten: boolean
  guardLastTarget: string | null
  seerResults: SeerResult[]
  pendingHunterId: string | null
  pendingNight: Record<NightActionKind, string[]>
  stepIndex: number
  winner: Winner | null
  eventCount: number
}

export function emptyNight(): Record<NightActionKind, string[]> {
  return {
    WOLF_KILL: [],
    ALPHA_CONVERT: [],
    WOLF_SEER_INSPECT: [],
    SEER_INSPECT: [],
    GUARD_PROTECT: [],
    WITCH_HEAL: [],
    WITCH_POISON: [],
    CUPID_LINK: [],
  }
}
