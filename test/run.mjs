// Chạy toàn bộ e2e: dựng server thật, cho từng bộ test đâm vào, dọn sạch.
// Dùng ở máy dev và ở CI. Thoát khác 0 nếu có bất kỳ assertion nào fail.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = Number(process.env.TEST_PORT ?? 3399)
const URL = `http://127.0.0.1:${PORT}`
const workdir = mkdtempSync(join(tmpdir(), 'werewolf-e2e-'))
const dbPath = join(workdir, 'test.db')

function startServer() {
  const child = spawn('npm', ['start'], {
    env: { ...process.env, PORT: String(PORT), WEREWOLF_DB: dbPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', () => {})
  child.stderr.on('data', () => {})
  return child
}

async function waitReady(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(URL, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return
    } catch {
      // chưa lên, thử lại
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Server không lên sau ${timeoutMs}ms`)
}

async function stopServer(child) {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve()
    }, 5000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

function runScript(file, args = [], capture = false) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join('test', file), ...args], {
      env: { ...process.env, WW_URL: URL },
      stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    })
    let out = ''
    if (capture) child.stdout.on('data', (chunk) => {
      out += chunk
      process.stdout.write(chunk)
    })
    child.on('exit', (code) => resolve({ code: code ?? 1, out }))
  })
}

let failed = 0
let server = startServer()

try {
  await waitReady()

  console.log('\n──── Bộ 1: một ván 6 người, kịch bản dẫn + lùi bước ────')
  failed += (await runScript('e2e.mjs')).code === 0 ? 0 : 1

  console.log('\n──── Bộ 2: bộ đủ 10 loại lá, 5 đêm ────')
  failed += (await runScript('e2e-full.mjs')).code === 0 ? 0 : 1

  console.log('\n──── Bộ 3: khôi phục sau khi server chết giữa ván ────')
  const written = await runScript('persist-write.mjs', [], true)
  if (written.code !== 0) {
    failed += 1
  } else {
    const state = written.out.trim().split('\n').at(-1)
    await stopServer(server)
    server = startServer()
    await waitReady()
    failed += (await runScript('persist-read.mjs', [state])).code === 0 ? 0 : 1
  }
} finally {
  await stopServer(server)
  rmSync(workdir, { recursive: true, force: true })
}

console.log(failed === 0 ? '\n✓ TẤT CẢ BỘ TEST PASS' : `\n✗ ${failed} bộ test FAIL`)
process.exit(failed === 0 ? 0 : 1)
