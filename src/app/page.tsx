'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { emit } from '@/lib/useRoom'

export default function Home() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [hostName, setHostName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createRoom() {
    setBusy(true)
    setError(null)
    const res = await emit('host:create', { hostName: hostName.trim() || 'Quản trò' })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    const roomCode = res.code as string
    localStorage.setItem(`ww:host:${roomCode}`, res.hostToken as string)
    router.push(`/host/${roomCode}`)
  }

  function joinRoom(e: React.FormEvent) {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (clean.length !== 6) return setError('Mã phòng gồm 6 ký tự.')
    router.push(`/play/${clean}`)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-4 py-12">
      <header className="text-center">
        <p className="text-5xl">🌕</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight">
          Ma Sói Online
        </h1>
        <p className="mt-2 text-sm text-mist">
          Quên mang bài cũng chơi được. Quản trò giữ nhịp, mỗi người chỉ thấy lá của mình.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl border border-blood-dim bg-blood-dim/20 px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}

      <section className="panel p-5">
        <p className="label">Bạn là quản trò</p>
        <input
          className="input mt-3"
          placeholder="Tên của bạn (không bắt buộc)"
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
          maxLength={40}
        />
        <button className="btn btn-primary mt-3 w-full" onClick={createRoom} disabled={busy}>
          {busy ? 'Đang tạo…' : 'Tạo phòng mới'}
        </button>
      </section>

      <div className="flex items-center gap-3 text-xs text-mist">
        <span className="h-px flex-1 bg-edge" />
        HOẶC
        <span className="h-px flex-1 bg-edge" />
      </div>

      <form className="panel p-5" onSubmit={joinRoom}>
        <p className="label">Bạn là người chơi</p>
        <input
          className="input mt-3 text-center text-2xl tracking-[0.4em] uppercase placeholder:tracking-normal placeholder:text-base placeholder:normal-case"
          placeholder="Nhập mã 6 ký tự"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
        />
        <button className="btn mt-3 w-full" type="submit">
          Vào phòng
        </button>
        <p className="mt-3 text-center text-xs text-mist">
          Hoặc quét mã QR quản trò đang chiếu.
        </p>
      </form>
    </main>
  )
}
