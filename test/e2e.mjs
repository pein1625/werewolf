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
const send = (s, ev, payload = {}) => new Promise((res) => s.emit(ev, payload, res))
async function act(s, ev, payload = {}) { const r = await send(s, ev, payload); await sleep(120); return r }

const host = await connect()
const created = await send(host, 'host:create', { hostName: 'QT' })
const code = created.code
await act(host, 'host:join', { code, hostToken: created.hostToken })
ok(created.ok && code?.length === 6, `tạo phòng ${code}`)

// ---- kiểm tra mã phòng trước khi nhập tên ----
const checkBad = await send(host, 'room:check', { code: 'ZZZZZZ' })
ok(checkBad.ok === false && checkBad.error.includes('Không tìm thấy phòng'), 'mã sai bị báo lỗi ngay, không cần nhập tên')
const checkOk = await send(host, 'room:check', { code: code.toLowerCase() })
ok(checkOk.ok && checkOk.code === code && checkOk.phase === 'LOBBY', 'mã đúng trả về phòng chờ (không phân biệt hoa thường)')

const names = ['An', 'Bình', 'Cường', 'Dũng', 'Em', 'Phúc']
const players = []
for (const name of names) {
  const s = await connect()
  const r = await send(s, 'player:join', { code, name })
  s.pid = r.playerId; s.pname = name; s.ptoken = r.playerToken
  players.push(s)
}
await sleep(200)
ok(host.latest.players.length === 6, 'sáu người vào phòng')

await act(host, 'host:setup', { roleCounts: { werewolf: 2, seer: 1, bodyguard: 1, witch: 1, hunter: 1 } })
ok((await act(host, 'host:deal')).ok, 'chia bài')
await sleep(250)

const hv = () => host.latest
const roleOf = (pid) => hv().players.find(p => p.id === pid).roleId
const byRole = (r) => players.find(p => roleOf(p.pid) === r)
const nameById = (id) => hv().players.find(p => p.id === id)?.name
const wolves = players.filter(p => roleOf(p.pid) === 'werewolf')
const hunter = byRole('hunter'), seer = byRole('seer'), guard = byRole('bodyguard'), witch = byRole('witch')

// ---- màn hình người chơi đã rút gọn ----
const pv = seer.latest
ok(pv.players === undefined, 'player view KHÔNG còn danh sách cả bàn')
ok(pv.seerResults === undefined, 'player view KHÔNG còn sổ soi')
ok(pv.witch === undefined, 'player view KHÔNG còn panel thuốc phù thủy')
ok(pv.timer === undefined, 'player view KHÔNG còn đồng hồ')
ok(pv.you.role?.name === 'Tiên tri' && typeof pv.you.alive === 'boolean', 'player view chỉ còn lá bài + sống/chết')
ok(JSON.stringify(pv).includes(hunter.pname) === false, 'payload gửi cho tiên tri không chứa tên/bài người khác')
ok(wolves[0].latest.allies.length === 1, 'sói vẫn thấy đồng bọn')
ok(seer.latest.allies.length === 0, 'dân không thấy đồng bọn')

ok((await act(host, 'host:start')).ok, 'bắt đầu đêm 1')

// ---- kịch bản đêm ----
const step = () => hv().step
const walk = async (payload = {}) => { const r = await act(host, 'host:step', { stepId: step().id, ...payload }); return r }

ok(hv().stepCount === 7, `đêm 1 có 7 bước (${hv().stepCount})`)
ok(step().id === 'guard', `bước 1 là Bảo vệ: "${step().speech}"`)
ok(step().targetIds.length === 6, 'bảo vệ chọn được cả 6 người (được tự che)')
await walk({ targetIds: [seer.pid] })

ok(step().id === 'wolf', `bước 2 là Sói: "${step().speech}"`)
ok(step().targetIds.includes(wolves[0].pid) === true, 'sói được phép cắn cả đồng bọn')
ok(step().targetIds.length === 6, `sói chọn được cả bàn, kể cả chính mình (${step().targetIds.length})`)
await walk({ targetIds: [hunter.pid] })

ok(step().id === 'seer', `bước 3 là Tiên tri: "${step().speech}"`)
await walk({ targetIds: [wolves[0].pid] })

ok(step().id === 'seer-answer', 'bước 4 là trả lời tiên tri')
ok(hv().pendingNight.SEER_INSPECT[0] === wolves[0].pid, 'quản trò thấy tiên tri soi ai để trả lời')
await walk()

ok(step().id === 'witch-heal', `bước 5 hỏi cứu: "${step().speech}"`)
ok(step().kind === 'confirm', 'bước cứu là câu hỏi có/không')
ok(step().speech.includes(hunter.pname), 'câu hỏi nêu đúng tên người bị cắn')
ok(step().confirmTargetId === hunter.pid, 'trả lời "có" sẽ cứu đúng người bị cắn')
await walk({ answer: 'no' })

ok(step().id === 'witch-poison', `bước 6 hỏi độc: "${step().speech}"`)
ok(step().skipLabel === 'Không dùng bình độc', 'có lựa chọn không dùng độc')
await walk({ targetIds: [] })

ok(step().id === 'night-end', 'bước 7 là kết đêm')

// ---- lùi một bước ----
await act(host, 'host:timer', { op: 'set', seconds: 47 })
const clockBefore = hv().timer.remainingSec
await act(host, 'host:undo')
ok(hv().timer.remainingSec === clockBefore, `lùi bước KHÔNG reset đồng hồ (${clockBefore}s -> ${hv().timer.remainingSec}s)`)
ok(hv().phase === 'NIGHT', 'vẫn trong đêm sau khi lùi')
ok(step().id === 'witch-poison', 'lùi một bước: quay lại đúng bước hỏi độc')
await act(host, 'host:undo')
ok(step().id === 'witch-heal', 'lùi tiếp: quay lại bước hỏi cứu')
ok(hv().pendingNight.WITCH_HEAL.length === 0, 'lùi xoá luôn câu trả lời đã ghi')
await walk({ answer: 'no' })
await walk({ targetIds: [] })

ok((await walk()).ok, 'kết thúc đêm 1')
ok(hv().phase === 'DAY_REVEAL', 'sang trời sáng')
ok(hv().deaths.length === 1 && hv().deaths[0].cause === 'WOLF', 'thợ săn chết vì sói')
ok(hunter.latest.you.alive === false && hunter.latest.you.deathCauseLabel === 'Bị sói cắn', 'người chơi thấy mình chết + lý do')

// ---- thợ săn chen ngang ----
ok(step().id === 'hunter', `bước thợ săn chen lên trước: "${step().speech}"`)
ok(step().speech.includes(hunter.pname), 'nêu đúng tên thợ săn')
await walk({ targetIds: [wolves[0].pid] })
ok(hv().deaths.some(d => d.cause === 'HUNTER' && d.name === wolves[0].pname), 'log ghi chết vì thợ săn')
ok(hv().wolvesAlive === 1, 'còn 1 sói')

ok(step().id === 'reveal', `quay lại bước công bố: "${step().speech}"`)
ok(step().speech.includes(hunter.pname) && step().speech.includes(wolves[0].pname), 'công bố nêu cả hai người chết')
await walk()
ok(step().id === 'discuss' && hv().phase === 'DAY_DISCUSS', 'sang thảo luận')
await walk()
ok(step().id === 'vote' && hv().phase === 'DAY_VOTE', `sang bỏ phiếu: "${step().speech}"`)
ok(step().skipLabel === 'Không treo ai', 'có lựa chọn không treo ai')
await walk({ targetIds: [wolves[1].pid] })
ok(hv().winner === 'VILLAGE', 'phát hiện phe Dân thắng')

ok((await act(host, 'host:end', { winner: 'VILLAGE' })).ok, 'kết thúc ván')
ok(seer.latest.reveal.length === 6, 'kết ván: người chơi thấy bảng lật bài')
ok(seer.latest.reveal.find(r => r.name === hunter.pname).deathCauseLabel === 'Bị sói cắn', 'kết ván: lộ nguyên nhân chết')

const checkEnded = await send(host, 'room:check', { code })
ok(checkEnded.ok && checkEnded.phase === 'ENDED', 'phòng đã kết thúc trả về phase ENDED')

const rejoin = await connect()
const back = await send(rejoin, 'player:join', { code, playerToken: seer.ptoken })
ok(back.ok && back.playerId === seer.pid, 'vào lại vẫn đúng lá bài')

console.log(`\n${fails === 0 ? 'TẤT CẢ PASS' : fails + ' FAIL'}`)
process.exit(fails === 0 ? 0 : 1)
