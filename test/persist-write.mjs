import { io } from 'socket.io-client'

const URL = process.env.WW_URL ?? 'http://localhost:3300'
const connect = () => {
  const s = io(URL, { path: '/api/socket', transports: ['websocket'] })
  s.latest = null
  s.on('state', (v) => { s.latest = v })
  return new Promise((r) => s.on('connect', () => r(s)))
}
const send = (s, ev, p = {}) => new Promise((r) => s.emit(ev, p, r))
const act = async (s, ev, p = {}) => { const r = await send(s, ev, p); await new Promise(x => setTimeout(x, 150)); return r }

const host = await connect()
const created = await send(host, 'host:create', { hostName: 'QT' })
await act(host, 'host:join', { code: created.code, hostToken: created.hostToken })

const toks = []
for (const n of ['A', 'B', 'C', 'D', 'E']) {
  const s = await connect()
  const r = await send(s, 'player:join', { code: created.code, name: n })
  toks.push([n, r.playerToken])
}
await act(host, 'host:setup', { roleCounts: { werewolf: 1, seer: 1, bodyguard: 1, witch: 1, villager: 1 } })
await act(host, 'host:deal')
await act(host, 'host:start')

// đi vài bước trong đêm để có trạng thái đáng kể
const step = () => host.latest.step
const walk = (p = {}) => act(host, 'host:step', { stepId: step().id, ...p })
const alive = host.latest.players.filter(p => p.alive).map(p => p.id)
await walk({ targetIds: [alive[0]] })   // bảo vệ
await walk({ targetIds: [alive[4]] })   // sói cắn
await walk({ targetIds: [alive[1]] })   // tiên tri soi
await walk()                            // trả lời tiên tri

const h = host.latest
console.log(JSON.stringify({
  code: created.code,
  hostToken: created.hostToken,
  toks,
  phase: h.phase,
  round: h.round,
  stepId: h.step.id,
  stepIndex: h.stepIndex,
  pendingWolf: h.pendingNight.WOLF_KILL,
  pendingGuard: h.pendingNight.GUARD_PROTECT,
  roles: h.players.map(p => [p.name, p.roleId, p.alive]),
  eventCount: h.eventCount,
}))
process.exit(0)
