import { randomBytes, randomInt } from 'node:crypto'
import { foldEvents, initialState, reduce } from '../game/reducer'
import type { GameEvent, GameState, Phase, TimerConfig } from '../game/events'
import type { RoleId } from '../game/roles'
import type { TimerView } from '../game/views'
import { store } from './db'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function makeCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return code
}

export function makeToken(): string {
  return randomBytes(24).toString('base64url')
}

export function makeId(): string {
  return randomBytes(9).toString('base64url')
}

type StoredEvent = GameEvent & { group: number }

type TimerRuntime = {
  phase: Phase
  durationSec: number
  endsAt: number | null
  remainingSec: number
  running: boolean
  expired: boolean
}

export class Room {
  readonly code: string
  readonly hostToken: string
  events: StoredEvent[] = []
  state: GameState
  timer: TimerRuntime | null = null
  private nextGroup = 1

  constructor(code: string, hostToken: string, events: StoredEvent[] = []) {
    this.code = code
    this.hostToken = hostToken
    this.events = events
    this.state = foldEvents(code, events)
    this.nextGroup = events.length ? Math.max(...events.map((e) => e.group)) + 1 : 1
  }

  apply(...newEvents: GameEvent[]): void {
    if (newEvents.length === 0) return
    const group = this.nextGroup++
    for (const event of newEvents) {
      const stored = { ...event, group } as StoredEvent
      this.events.push(stored)
      store.appendEvent(this.code, this.events.length, stored)
      this.state = reduce(this.state, stored)
    }
  }

  get canUndo(): boolean {
    return this.events.length > 0
  }

  undo(): boolean {
    if (this.events.length === 0) return false
    const phaseBefore = this.state.phase
    const lastGroup = this.events[this.events.length - 1].group
    let cut = this.events.length
    while (cut > 0 && this.events[cut - 1].group === lastGroup) cut--
    this.events = this.events.slice(0, cut)
    store.truncateEventsFrom(this.code, cut + 1)
    this.state = this.events.length ? foldEvents(this.code, this.events) : initialState(this.code)
    this.nextGroup = lastGroup
    if (this.state.phase !== phaseBefore) this.syncTimerToPhase()
    return true
  }

  timerView(): TimerView | null {
    if (!this.timer) return null
    const remaining = this.timer.running && this.timer.endsAt
      ? Math.max(0, Math.round((this.timer.endsAt - Date.now()) / 1000))
      : this.timer.remainingSec
    return {
      phase: this.timer.phase,
      durationSec: this.timer.durationSec,
      remainingSec: remaining,
      running: this.timer.running,
      expired: this.timer.expired,
    }
  }

  setTimer(durationSec: number, autoStart: boolean): void {
    this.timer = {
      phase: this.state.phase,
      durationSec,
      endsAt: autoStart ? Date.now() + durationSec * 1000 : null,
      remainingSec: durationSec,
      running: autoStart,
      expired: false,
    }
  }

  startTimer(): void {
    if (!this.timer) return
    if (this.timer.running) return
    this.timer.endsAt = Date.now() + this.timer.remainingSec * 1000
    this.timer.running = true
    this.timer.expired = false
  }

  pauseTimer(): void {
    if (!this.timer?.running) return
    this.timer.remainingSec = Math.max(0, Math.round(((this.timer.endsAt ?? 0) - Date.now()) / 1000))
    this.timer.running = false
    this.timer.endsAt = null
  }

  resetTimer(): void {
    if (!this.timer) return
    this.timer.remainingSec = this.timer.durationSec
    this.timer.endsAt = null
    this.timer.running = false
    this.timer.expired = false
  }

  addTime(deltaSec: number): void {
    if (!this.timer) return
    if (this.timer.running && this.timer.endsAt) {
      this.timer.endsAt = Math.max(Date.now(), this.timer.endsAt + deltaSec * 1000)
      if (this.timer.endsAt > Date.now()) this.timer.expired = false
    } else {
      this.timer.remainingSec = Math.max(0, this.timer.remainingSec + deltaSec)
      if (this.timer.remainingSec > 0) this.timer.expired = false
    }
  }

  syncTimerToPhase(): void {
    const phase = this.state.phase
    const durations = this.state.timers as TimerConfig & Record<string, number>
    const duration = durations[phase]
    if (typeof duration !== 'number') {
      this.timer = null
      return
    }
    this.setTimer(duration, true)
  }

  tickExpiry(): boolean {
    if (!this.timer?.running || !this.timer.endsAt) return false
    if (Date.now() < this.timer.endsAt) return false
    this.timer.running = false
    this.timer.remainingSec = 0
    this.timer.endsAt = null
    this.timer.expired = true
    return true
  }
}

const rooms = new Map<string, Room>()

export function createRoom(hostName: string): Room {
  let code = makeCode()
  while (store.getRoom(code) || rooms.has(code)) code = makeCode()
  const hostToken = makeToken()
  store.createRoom(code, hostToken, hostName)
  const room = new Room(code, hostToken)
  room.apply({ type: 'ROOM_CREATED', at: Date.now(), code })
  rooms.set(code, room)
  return room
}

export function getRoom(code: string): Room | null {
  const upper = code.toUpperCase()
  const cached = rooms.get(upper)
  if (cached) return cached
  const row = store.getRoom(upper)
  if (!row) return null
  const events = store.loadEvents(upper) as (GameEvent & { group: number })[]
  const room = new Room(upper, row.host_token, events)
  room.syncTimerToPhase()
  rooms.set(upper, room)
  return room
}

export function allRooms(): Room[] {
  return [...rooms.values()]
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function dealAssignments(
  playerIds: string[],
  roleCounts: Partial<Record<RoleId, number>>,
): { playerId: string; roleId: RoleId }[] {
  const deck: RoleId[] = []
  for (const [roleId, count] of Object.entries(roleCounts)) {
    for (let i = 0; i < (count ?? 0); i++) deck.push(roleId as RoleId)
  }
  const shuffledDeck = shuffle(deck)
  const shuffledPlayers = shuffle(playerIds)
  return shuffledPlayers.map((playerId, i) => ({ playerId, roleId: shuffledDeck[i] }))
}

export const PHASE_ORDER: Phase[] = ['NIGHT', 'DAY_REVEAL', 'DAY_DISCUSS', 'DAY_VOTE']

export function nextPhase(current: Phase, round: number): { phase: Phase; round: number } {
  const idx = PHASE_ORDER.indexOf(current)
  if (idx === -1) return { phase: 'NIGHT', round: Math.max(1, round) }
  if (idx === PHASE_ORDER.length - 1) return { phase: 'NIGHT', round: round + 1 }
  return { phase: PHASE_ORDER[idx + 1], round }
}

export const PHASE_LABEL: Record<Phase, string> = {
  LOBBY: 'Phòng chờ',
  DEALING: 'Đã chia bài',
  NIGHT: 'Đêm',
  DAY_REVEAL: 'Sáng — công bố',
  DAY_DISCUSS: 'Thảo luận',
  DAY_VOTE: 'Bỏ phiếu',
  ENDED: 'Kết thúc',
}
