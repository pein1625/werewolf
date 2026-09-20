import type { Server as HttpServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import type { GameEvent, GameState, Winner } from '../game/events'
import { DEFAULT_TIMERS } from '../game/events'
import type { NightActionKind, RoleId } from '../game/roles'
import { ROLES } from '../game/roles'
import { countRoles, validateSetup } from '../game/packs'
import { currentStep, type Step } from '../game/script'
import { buildHostView, buildPlayerView } from '../game/views'
import { store } from './db'
import {
  createRoom,
  dealAssignments,
  getRoom,
  makeId,
  makeToken,
  nextPhase,
  type Room,
} from './rooms'

type Ack = (res: { ok: true; [k: string]: unknown } | { ok: false; error: string }) => void

function fail(ack: Ack | undefined, error: string): void {
  ack?.({ ok: false, error })
}

function nightActionError(
  state: GameState,
  action: NightActionKind,
  targets: string[],
): string | null {
  if (targets.length === 0) return null
  if (action === 'WITCH_HEAL' && state.witchHealUsed) return 'Phù thủy đã dùng bình cứu rồi.'
  if (action === 'WITCH_POISON' && state.witchPoisonUsed) return 'Phù thủy đã dùng bình độc rồi.'
  if (action === 'ALPHA_CONVERT' && state.alphaConvertUsed)
    return 'Sói trùm đã dùng khả năng biến sói rồi.'
  if (action === 'GUARD_PROTECT' && targets[0] === state.guardLastTarget)
    return 'Bảo vệ không được che cùng một người hai đêm liên tiếp.'
  if (action === 'CUPID_LINK' && targets.length !== 2) return 'Cupid phải chọn đúng 2 người.'
  return null
}

function eventsForStep(
  state: GameState,
  step: Step,
  targets: string[],
  at: number,
): { events: GameEvent[]; error?: string } {
  switch (step.action) {
    case 'NONE':
      return { events: [] }

    case 'RESOLVE_NIGHT': {
      const next = nextPhase('NIGHT', state.round)
      return {
        events: [
          { type: 'NIGHT_RESOLVED', at, round: state.round },
          { type: 'PHASE_CHANGED', at, phase: next.phase, round: next.round },
        ],
      }
    }

    case 'NEXT_PHASE': {
      const next = nextPhase(state.phase, state.round)
      return { events: [{ type: 'PHASE_CHANGED', at, phase: next.phase, round: next.round }] }
    }

    case 'LYNCH':
      return { events: [{ type: 'LYNCH', at, round: state.round, targetId: targets[0] ?? null }] }

    case 'HUNTER_SHOT': {
      const hunterId = state.pendingHunterId
      if (!hunterId) return { events: [], error: 'Không có Thợ săn nào đang chờ bắn.' }
      if (!targets[0]) return { events: [], error: 'Chọn một người cho Thợ săn bắn.' }
      return { events: [{ type: 'HUNTER_SHOT', at, round: state.round, hunterId, targetId: targets[0] }] }
    }

    default: {
      const action = step.action as NightActionKind
      const error = nightActionError(state, action, targets)
      if (error) return { events: [], error }
      return {
        events: [{ type: 'NIGHT_ACTION', at, round: state.round, action, actorId: null, targetIds: targets }],
      }
    }
  }
}

export function attachSockets(httpServer: HttpServer): Server {
  const io = new Server(httpServer, { path: '/api/socket', serveClient: false })

  function broadcast(room: Room): void {
    const timer = room.timerView()
    io.to(`host:${room.code}`).emit('state', buildHostView(room.state, timer, room.canUndo))
    for (const player of room.state.players) {
      io.to(`player:${room.code}:${player.id}`).emit('state', buildPlayerView(room.state, player.id))
    }
  }

  setInterval(() => {
    for (const code of io.sockets.adapter.rooms.keys()) {
      if (!code.startsWith('host:')) continue
      const room = getRoom(code.slice(5))
      if (room?.tickExpiry()) {
        io.to(`host:${room.code}`).emit('timer:expired', { phase: room.state.phase })
        broadcast(room)
      }
    }
  }, 1000)

  io.on('connection', (socket: Socket) => {
    let boundCode: string | null = null
    let boundPlayerId: string | null = null
    let isHost = false

    function requireHost(ack?: Ack): Room | null {
      if (!boundCode || !isHost) {
        fail(ack, 'Bạn không phải quản trò của phòng này.')
        return null
      }
      const room = getRoom(boundCode)
      if (!room) {
        fail(ack, 'Phòng không tồn tại.')
        return null
      }
      return room
    }

    socket.on('host:create', ({ hostName }: { hostName?: string }, ack?: Ack) => {
      const room = createRoom((hostName ?? 'Quản trò').slice(0, 40))
      ack?.({ ok: true, code: room.code, hostToken: room.hostToken })
    })

    socket.on('room:check', ({ code }: { code?: string }, ack?: Ack) => {
      const room = getRoom((code ?? '').trim())
      if (!room) return fail(ack, 'Không tìm thấy phòng. Kiểm tra lại mã.')
      ack?.({
        ok: true,
        code: room.code,
        phase: room.state.phase,
        playerCount: room.state.players.length,
      })
    })

    socket.on('host:join', ({ code, hostToken }: { code: string; hostToken: string }, ack?: Ack) => {
      const room = getRoom(code)
      if (!room) return fail(ack, 'Không tìm thấy phòng.')
      if (room.hostToken !== hostToken) return fail(ack, 'Mã quản trò không đúng.')
      boundCode = room.code
      isHost = true
      socket.join(`host:${room.code}`)
      ack?.({ ok: true, code: room.code })
      socket.emit('state', buildHostView(room.state, room.timerView(), room.canUndo))
    })

    socket.on(
      'player:join',
      ({ code, name, playerToken }: { code: string; name: string; playerToken?: string }, ack?: Ack) => {
        const room = getRoom(code)
        if (!room) return fail(ack, 'Không tìm thấy phòng. Kiểm tra lại mã.')

        const existing = playerToken ? store.memberByToken(room.code, playerToken) : undefined
        const stillInGame = existing && room.state.players.some((p) => p.id === existing.id)

        if (stillInGame && existing) {
          boundCode = room.code
          boundPlayerId = existing.id
          socket.join(`player:${room.code}:${existing.id}`)
          ack?.({ ok: true, playerId: existing.id, playerToken: existing.token, code: room.code })
          socket.emit('state', buildPlayerView(room.state, existing.id))
          return
        }

        if (room.state.phase !== 'LOBBY') {
          return fail(ack, 'Ván đã bắt đầu, không vào được nữa. Nhờ quản trò thêm bạn vào.')
        }
        const trimmed = (name ?? '').trim().slice(0, 24)
        if (trimmed.length < 1) return fail(ack, 'Tên không được để trống.')
        if (room.state.players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
          return fail(ack, 'Tên này có người dùng rồi, chọn tên khác nhé.')
        }
        if (room.state.players.length >= 24) return fail(ack, 'Phòng đã đủ 24 người.')

        const playerId = makeId()
        const token = makeToken()
        store.saveMember({ id: playerId, code: room.code, token, name: trimmed })
        room.apply({ type: 'PLAYER_JOINED', at: Date.now(), playerId, name: trimmed })

        boundCode = room.code
        boundPlayerId = playerId
        socket.join(`player:${room.code}:${playerId}`)
        ack?.({ ok: true, playerId, playerToken: token, code: room.code })
        broadcast(room)
      },
    )

    socket.on(
      'host:setup',
      (
        { roleCounts, timers }: { roleCounts: Partial<Record<RoleId, number>>; timers?: typeof DEFAULT_TIMERS },
        ack?: Ack,
      ) => {
        const room = requireHost(ack)
        if (!room) return
        if (room.state.phase !== 'LOBBY') return fail(ack, 'Chỉ đổi được bộ bài khi còn ở phòng chờ.')
        const clean: Partial<Record<RoleId, number>> = {}
        for (const [id, n] of Object.entries(roleCounts ?? {})) {
          if (!(id in ROLES)) continue
          const count = Math.max(0, Math.floor(Number(n) || 0))
          if (count > 0) clean[id as RoleId] = count
        }
        room.apply({
          type: 'SETUP_CHANGED',
          at: Date.now(),
          roleCounts: clean,
          timers: { ...DEFAULT_TIMERS, ...(room.state.timers ?? {}), ...(timers ?? {}) },
        })
        room.syncTimerToPhase()
        broadcast(room)
        ack?.({ ok: true })
      },
    )

    socket.on('host:deal', (_payload: unknown, ack?: Ack) => {
      const room = requireHost(ack)
      if (!room) return
      if (room.state.phase !== 'LOBBY') return fail(ack, 'Đã chia bài rồi. Bấm Hoàn tác nếu muốn chia lại.')
      const playerIds = room.state.players.map((p) => p.id)
      if (playerIds.length < 4) return fail(ack, 'Cần ít nhất 4 người chơi.')
      const blocking = validateSetup(room.state.roleCounts, playerIds.length).filter(
        (i) => i.level === 'error',
      )
      if (blocking.length) return fail(ack, blocking[0].message)
      if (countRoles(room.state.roleCounts) !== playerIds.length) {
        return fail(ack, 'Số lá bài không khớp số người chơi.')
      }
      room.apply({
        type: 'ROLES_DEALT',
        at: Date.now(),
        assignments: dealAssignments(playerIds, room.state.roleCounts),
      })
      broadcast(room)
      ack?.({ ok: true })
    })

    socket.on('host:start', (_payload: unknown, ack?: Ack) => {
      const room = requireHost(ack)
      if (!room) return
      if (room.state.phase !== 'DEALING') return fail(ack, 'Phải chia bài trước khi bắt đầu.')
      room.apply({ type: 'GAME_STARTED', at: Date.now() })
      room.syncTimerToPhase()
      broadcast(room)
      ack?.({ ok: true })
    })

    socket.on(
      'host:step',
      (
        { stepId, targetIds, answer }: { stepId: string; targetIds?: string[]; answer?: 'yes' | 'no' },
        ack?: Ack,
      ) => {
        const room = requireHost(ack)
        if (!room) return
        const step = currentStep(room.state)
        if (!step) return fail(ack, 'Chưa có bước nào để làm — ván chưa bắt đầu hoặc đã kết thúc.')
        if (step.id !== stepId) return fail(ack, 'Bước đã thay đổi. Màn hình vừa được cập nhật.')

        let targets: string[] = []
        if (step.kind === 'confirm') {
          targets = answer === 'yes' && step.confirmTargetId ? [step.confirmTargetId] : []
        } else if (step.kind === 'pick') {
          const allowed = new Set(step.targetIds ?? [])
          targets = (targetIds ?? []).filter((id) => allowed.has(id))
          if (targets.length > (step.count ?? 1)) targets = targets.slice(0, step.count ?? 1)
        }

        const { events, error } = eventsForStep(room.state, step, targets, Date.now())
        if (error) return fail(ack, error)

        const advances =
          step.id !== 'hunter' && step.action !== 'RESOLVE_NIGHT' && step.action !== 'NEXT_PHASE'
        if (advances) {
          events.push({ type: 'STEP_SET', at: Date.now(), index: room.state.stepIndex + 1 })
        }

        room.apply(...events)
        if (step.action === 'RESOLVE_NIGHT' || step.action === 'NEXT_PHASE') room.syncTimerToPhase()
        broadcast(room)
        ack?.({ ok: true })
      },
    )

    socket.on('host:manualDeath', ({ playerId }: { playerId: string }, ack?: Ack) => {
      const room = requireHost(ack)
      if (!room) return
      room.apply({ type: 'MANUAL_DEATH', at: Date.now(), round: room.state.round, playerId })
      broadcast(room)
      ack?.({ ok: true })
    })

    socket.on('host:revive', ({ playerId }: { playerId: string }, ack?: Ack) => {
      const room = requireHost(ack)
      if (!room) return
      room.apply({ type: 'MANUAL_REVIVE', at: Date.now(), round: room.state.round, playerId })
      broadcast(room)
      ack?.({ ok: true })
    })

    socket.on('host:renamePlayer', ({ playerId, name }: { playerId: string; name: string }, ack?: Ack) => {
      const room = requireHost(ack)
      if (!room) return
      const trimmed = (name ?? '').trim().slice(0, 24)
      if (!trimmed) return fail(ack, 'Tên không được để trống.')
      room.apply({ type: 'PLAYER_RENAMED', at: Date.now(), playerId, name: trimmed })
      broadcast(room)
      ack?.({ ok: true })
    })

    socket.on('host:removePlayer', ({ playerId }: { playerId: string }, ack?: Ack) => {
      const room = requireHost(ack)
      if (!room) return
      if (room.state.phase !== 'LOBBY') return fail(ack, 'Chỉ xoá người chơi khi còn ở phòng chờ.')
      room.apply({ type: 'PLAYER_REMOVED', at: Date.now(), playerId })
      store.removeMember(playerId)
      broadcast(room)
      ack?.({ ok: true })
    })

    socket.on('host:undo', (_payload: unknown, ack?: Ack) => {
      const room = requireHost(ack)
      if (!room) return
      if (!room.undo()) return fail(ack, 'Không còn thao tác nào để hoàn tác.')
      broadcast(room)
      ack?.({ ok: true })
    })

    socket.on('host:end', ({ winner }: { winner: Winner }, ack?: Ack) => {
      const room = requireHost(ack)
      if (!room) return
      room.apply({ type: 'GAME_ENDED', at: Date.now(), winner: winner ?? 'NOBODY' })
      store.endRoom(room.code)
      room.timer = null
      broadcast(room)
      ack?.({ ok: true })
    })

    socket.on(
      'host:timer',
      (
        { op, seconds }: { op: 'set' | 'start' | 'pause' | 'reset' | 'add'; seconds?: number },
        ack?: Ack,
      ) => {
        const room = requireHost(ack)
        if (!room) return
        if (op === 'set') room.setTimer(Math.max(5, Math.floor(seconds ?? 60)), false)
        else if (op === 'start') room.startTimer()
        else if (op === 'pause') room.pauseTimer()
        else if (op === 'reset') room.resetTimer()
        else if (op === 'add') room.addTime(Math.floor(seconds ?? 30))
        broadcast(room)
        ack?.({ ok: true })
      },
    )

    socket.on('disconnect', () => {
      if (boundCode && boundPlayerId) {
        const room = getRoom(boundCode)
        if (room) broadcast(room)
      }
    })
  })

  return io
}
