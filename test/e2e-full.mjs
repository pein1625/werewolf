import { io } from 'socket.io-client'

const URL = process.env.WW_URL ?? 'http://localhost:3100'
const opts = { path: '/api/socket', transports: ['websocket'] }
let fails = 0
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails++ }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function connect() {
  const s = io(URL, opts)
  s.latest = null
  s.on('state', (v) => { s.latest = v })
  return new Promise((res) => s.on('connect', () => res(s)))
}
const send = (s, ev, p = {}) => new Promise((res) => s.emit(ev, p, res))
async function act(s, ev, p = {}) { const r = await send(s, ev, p); await sleep(120); return r }

const host = await connect()
const created = await send(host, 'host:create', {})
const code = created.code
await act(host, 'host:join', { code, hostToken: created.hostToken })

const names = ['P1','P2','P3','P4','P5','P6','P7','P8','P9','P10','P11','P12']
const players = []
for (const name of names) {
  const s = await connect()
  const r = await send(s, 'player:join', { code, name })
  s.pid = r.playerId; s.pname = name
  players.push(s)
}
await sleep(250)

// bộ đủ 12 lá: 2 sói + trùm + sói tiên tri + tiên tri + bảo vệ + phù thủy + thợ săn + già làng + cupid + 2 dân
await act(host, 'host:setup', { roleCounts: {
  werewolf: 2, alpha_wolf: 1, wolf_seer: 1, seer: 1, bodyguard: 1,
  witch: 1, hunter: 1, elder: 1, cupid: 1, villager: 2,
}})
ok((await act(host, 'host:deal')).ok, 'chia bộ đủ 10 loại lá cho 12 người')
await sleep(250)

const hv = () => host.latest
const step = () => hv().step
const roleOf = (pid) => hv().players.find(p => p.id === pid).roleId
const byRole = (r) => players.find(p => roleOf(p.pid) === r)
const walk = async (p = {}) => act(host, 'host:step', { stepId: step().id, ...p })
const ids = () => hv().players.filter(p => p.alive).map(p => p.id)

const cupid = byRole('cupid'), elder = byRole('elder'), seer = byRole('seer')
const guard = byRole('bodyguard'), witch = byRole('witch'), alpha = byRole('alpha_wolf')
const wolfSeer = byRole('wolf_seer')
const villagers = players.filter(p => roleOf(p.pid) === 'villager')

await act(host, 'host:start')
ok(hv().stepCount === 12, `đêm 1 đủ lá có 12 bước (${hv().stepCount})`)

const order = []
ok(step().id === 'cupid', `mở màn là Cupid: "${step().speech}"`)
await walk({ targetIds: [villagers[0].pid, elder.pid] })
order.push('cupid')

ok(step().id === 'lovers-meet', 'bước cho đôi tình nhân nhìn nhau')
ok(step().hint.includes(villagers[0].pname) && step().hint.includes(elder.pname), 'quản trò biết đôi đó là ai')
ok(villagers[0].latest.you.loverName === elder.pname, 'người chơi biết người yêu của mình')
ok(seer.latest.you.isLover === false, 'người ngoài không biết gì về đôi tình nhân')
await walk()

ok(step().id === 'guard', 'tới Bảo vệ')
await walk({ targetIds: [seer.pid] })

ok(step().id === 'wolf', 'tới Sói')
const wolfTargets = step().targetIds
ok(wolfTargets.includes(alpha.pid) && wolfTargets.includes(wolfSeer.pid), 'sói trùm và sói tiên tri vẫn nằm trong danh sách cắn được')
ok(wolfTargets.length === 12, `sói chọn được cả 12 người (${wolfTargets.length})`)
await walk({ targetIds: [villagers[1].pid] })

ok(step().id === 'alpha', `tới Sói trùm: "${step().speech}"`)
ok(step().kind === 'confirm' && step().confirmTargetId === villagers[1].pid, 'hỏi có/không, biến đúng người sói vừa chọn')
await walk({ answer: 'yes' })

ok(step().id === 'wolfseer', 'tới Sói tiên tri')
await walk({ targetIds: [seer.pid] })
ok(step().id === 'wolfseer-answer', 'có bước trả lời cho sói tiên tri')
ok(hv().pendingNight.WOLF_SEER_INSPECT[0] === seer.pid, 'quản trò biết soi ai để đọc đúng lá')
await walk()

ok(step().id === 'seer', 'tới Tiên tri')
await walk({ targetIds: [alpha.pid] })
await walk()

ok(step().id === 'witch-heal', 'tới Phù thủy cứu')
ok(step().confirmTargetId === null, 'sói dùng biến sói nên không ai bị cắn — không có ai để cứu')
ok(step().speech.includes('không ai bị sói cắn'), `không báo nhầm tên cho phù thủy: "${step().speech}"`)
await walk({ answer: 'no' })
await walk({ targetIds: [] })
await walk()

ok(hv().phase === 'DAY_REVEAL', 'sang ngày')
ok(hv().deaths.length === 0, 'đêm biến sói: không ai chết')
ok(roleOf(villagers[1].pid) === 'werewolf', 'dân bị biến thành Sói')
ok(villagers[1].latest.you.role.name === 'Sói', 'người bị biến thấy lá mới của mình')
ok(villagers[1].latest.allies.length === 4, `người bị biến thấy cả bầy sói (${villagers[1].latest.allies.length})`)
ok(hv().wolvesAlive === 5, `phe sói giờ có 5 (${hv().wolvesAlive})`)

await walk(); await walk()
ok(hv().phase === 'DAY_VOTE', 'tới bỏ phiếu')
await walk({ targetIds: [] })
ok(hv().deaths.length === 0, 'không treo ai thì không ai chết')
await walk()

// ---- đêm 2 ----
ok(hv().phase === 'NIGHT' && hv().round === 2, 'sang đêm 2')
ok(hv().stepCount === 9, `đêm 2 còn 9 bước — hết Cupid, hết Sói trùm (${hv().stepCount})`)
ok(step().id === 'guard', 'đêm 2 mở màn bằng Bảo vệ')
ok(step().targetIds.includes(seer.pid) === false, 'bảo vệ không được che lại người đêm trước')
ok(step().hint.includes(seer.pname), 'nhắc quản trò đêm trước đã che ai')
await walk({ targetIds: [witch.pid] })

ok(step().id === 'wolf', 'tới Sói')
await walk({ targetIds: [elder.pid] })
ok(step().id === 'wolfseer', 'không còn bước Sói trùm vì đã dùng')
await walk({ targetIds: [] }); await walk()
await walk({ targetIds: [] }); await walk()
ok(step().id === 'witch-heal', 'phù thủy vẫn còn cả hai bình')
ok(step().speech.includes(elder.pname), 'báo đúng người bị cắn đêm 2')
await walk({ answer: 'no' })
await walk({ targetIds: [] })
await walk()

ok(hv().deaths.length === 0, 'Già làng chịu được nhát cắn đầu tiên')
ok(hv().elderBitten === true, 'đánh dấu già làng đã bị cắn một lần')
ok(elder.latest.elderBitten === true, 'già làng tự biết mình đã bị cắn một lần')

// ---- đêm 3: cắn già làng lần hai, kéo theo người yêu ----
await walk(); await walk(); await walk({ targetIds: [] }); await walk()
ok(hv().phase === 'NIGHT' && hv().round === 3, 'sang đêm 3')
await walk({ targetIds: [seer.pid] })
await walk({ targetIds: [elder.pid] })
await walk({ targetIds: [] }); await walk()
await walk({ targetIds: [] }); await walk()
await walk({ answer: 'no' })
await walk({ targetIds: [] })
await walk()

const dead = hv().deaths
ok(dead.some(d => d.name === elder.pname && d.cause === 'WOLF'), 'lần cắn thứ hai giết được Già làng')
ok(dead.some(d => d.name === villagers[0].pname && d.cause === 'LOVER'), 'người yêu chết theo, log ghi rõ lý do')
ok(villagers[0].latest.you.deathCauseLabel === 'Chết theo người yêu', 'người chơi thấy đúng lý do chết của mình')

// ---- phù thủy dùng độc, kiểm tra hết bình ----
await walk(); await walk(); await walk({ targetIds: [] }); await walk()
ok(hv().round === 4, 'sang đêm 4')
await walk({ targetIds: [] })
await walk({ targetIds: [seer.pid] })
await walk({ targetIds: [] }); await walk()
await walk({ targetIds: [] }); await walk()
ok(step().id === 'witch-heal', 'còn bước cứu')
await walk({ answer: 'yes' })
ok(step().id === 'witch-poison', 'tới bước độc')
await walk({ targetIds: [alpha.pid] })
await walk()
ok(hv().deaths.some(d => d.name === alpha.pname && d.cause === 'WITCH_POISON'), 'bình độc giết Sói trùm')
ok(hv().deaths.some(d => d.name === seer.pname) === false, 'bình cứu cứu được Tiên tri')
ok(hv().witchHealUsed && hv().witchPoisonUsed, 'hai bình đã dùng hết')

await walk(); await walk(); await walk({ targetIds: [] }); await walk()
ok(hv().round === 5, 'sang đêm 5')
const nightIds = []
for (let i = 0; i < hv().stepCount; i++) nightIds.push(i)
ok(hv().stepCount === 8, `đêm 5 còn 8 bước — phù thủy hết thuốc thành một bước gọi suông (${hv().stepCount})`)
ok(hv().step.id === 'guard', 'đêm 5 vẫn mở màn bằng Bảo vệ')

console.log(`\n${fails === 0 ? 'TẤT CẢ PASS' : fails + ' FAIL'}`)
process.exit(fails === 0 ? 0 : 1)
