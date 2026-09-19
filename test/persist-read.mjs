import { io } from 'socket.io-client'

const URL = process.env.WW_URL ?? 'http://localhost:3300'
const before = JSON.parse(process.argv[2])
let fails = 0
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++ }

const connect = () => {
  const s = io(URL, { path: '/api/socket', transports: ['websocket'] })
  s.latest = null
  s.on('state', (v) => { s.latest = v })
  return new Promise((r) => s.on('connect', () => r(s)))
}
const send = (s, ev, p = {}) => new Promise((r) => s.emit(ev, p, r))
const wait = (ms) => new Promise(r => setTimeout(r, ms))

const host = await connect()
const joined = await send(host, 'host:join', { code: before.code, hostToken: before.hostToken })
await wait(400)
ok(joined.ok, 'quản trò vào lại phòng sau khi container restart')

const h = host.latest
ok(h.phase === before.phase && h.round === before.round, `đúng phase/round (${h.phase} ${h.round})`)
ok(h.step.id === before.stepId, `đứng đúng bước đang dở (${h.step.id})`)
ok(h.stepIndex === before.stepIndex, `con trỏ bước không đổi (${h.stepIndex})`)
ok(JSON.stringify(h.pendingNight.WOLF_KILL) === JSON.stringify(before.pendingWolf), 'giữ nguyên lựa chọn của sói trong đêm dở')
ok(JSON.stringify(h.pendingNight.GUARD_PROTECT) === JSON.stringify(before.pendingGuard), 'giữ nguyên lựa chọn của bảo vệ')
ok(JSON.stringify(h.players.map(p => [p.name, p.roleId, p.alive])) === JSON.stringify(before.roles), 'bài của từng người khôi phục y nguyên')
ok(h.eventCount === before.eventCount, `event log đủ ${before.eventCount} event`)
ok(h.canUndo === true, 'vẫn lùi bước được sau restart')

const [name, tok] = before.toks[0]
const p = await connect()
const back = await send(p, 'player:join', { code: before.code, playerToken: tok })
await wait(400)
ok(back.ok && p.latest.you.roleId === before.roles.find(r => r[0] === name)[1],
   'người chơi vào lại thấy đúng lá bài cũ')

console.log(`\n${fails === 0 ? 'TẤT CẢ PASS' : fails + ' FAIL'}`)
process.exit(fails === 0 ? 0 : 1)
