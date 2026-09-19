'use client'

import { use, useCallback, useEffect, useState } from 'react'
import type { HostView } from '@/game/views'
import { beep, emit, useRoomState } from '@/lib/useRoom'
import { HostConsole } from './HostConsole'

export default function HostPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const roomCode = code.toUpperCase()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  const connect = useCallback(async () => {
    const hostToken = localStorage.getItem(`ww:host:${roomCode}`)
    if (!hostToken) return { ok: false as const, error: 'Máy này không giữ quyền quản trò của phòng.' }
    return emit('host:join', { code: roomCode, hostToken })
  }, [roomCode])

  const onExpire = useCallback(() => {
    beep()
    navigator.vibrate?.([200, 100, 200])
  }, [])

  const { state, error } = useRoomState<HostView>(connect, { onExpire })

  if (!ready) return null

  if (error && !state) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 text-center">
        <p className="text-4xl">🔒</p>
        <p className="text-lg font-semibold">{error}</p>
        <p className="text-sm text-mist">
          Quyền quản trò gắn với trình duyệt đã tạo phòng. Mở lại đúng máy đó, hoặc tạo phòng mới.
        </p>
        <a className="btn btn-primary" href="/">
          Về trang chủ
        </a>
      </main>
    )
  }

  if (!state) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-sm text-mist">
        Đang mở bảng quản trò…
      </main>
    )
  }

  return <HostConsole view={state} />
}
