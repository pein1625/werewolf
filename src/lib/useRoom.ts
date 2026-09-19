'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { HostView, PlayerView } from '@/game/views'

export type Ack = { ok: true; [k: string]: unknown } | { ok: false; error: string }

let shared: Socket | null = null

function socket(): Socket {
  if (!shared) shared = io({ path: '/api/socket', transports: ['websocket', 'polling'] })
  return shared
}

export function useSocket(): Socket {
  const ref = useRef<Socket | null>(null)
  if (!ref.current) ref.current = socket()
  return ref.current
}

export function emit<T extends Ack = Ack>(event: string, payload: unknown = {}): Promise<T> {
  return new Promise((resolve) => {
    socket().emit(event, payload, (res: T) => resolve(res))
  })
}

type Options = { onExpire?: (phase: string) => void }

export function useRoomState<T extends HostView | PlayerView>(
  connect: () => Promise<Ack>,
  options: Options = {},
): { state: T | null; error: string | null; retry: () => void } {
  const [state, setState] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const onExpire = options.onExpire

  useEffect(() => {
    const s = socket()
    const onState = (next: T) => {
      setState(next)
      setError(null)
    }
    const onTimerExpired = ({ phase }: { phase: string }) => onExpire?.(phase)

    s.on('state', onState as (v: unknown) => void)
    s.on('timer:expired', onTimerExpired)

    const run = async () => {
      const res = await connect()
      if (!res.ok) setError(res.error)
    }
    if (s.connected) void run()
    s.on('connect', run)

    return () => {
      s.off('state', onState as (v: unknown) => void)
      s.off('timer:expired', onTimerExpired)
      s.off('connect', run)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce])

  const retry = useCallback(() => setNonce((n) => n + 1), [])
  return { state, error, retry }
}

export function useCountdown(remainingSec: number | undefined, running: boolean | undefined): number {
  const [value, setValue] = useState(remainingSec ?? 0)

  useEffect(() => {
    setValue(remainingSec ?? 0)
  }, [remainingSec])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setValue((v) => Math.max(0, v - 1)), 1000)
    return () => clearInterval(id)
  }, [running])

  return value
}

export function formatClock(totalSec: number): string {
  const m = Math.floor(Math.max(0, totalSec) / 60)
  const s = Math.max(0, totalSec) % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

let audio: AudioContext | null = null

export function beep(): void {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    const now = audio.currentTime
    for (let i = 0; i < 3; i++) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      const start = now + i * 0.28
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22)
      osc.connect(gain).connect(audio.destination)
      osc.start(start)
      osc.stop(start + 0.24)
    }
  } catch {
    // trình duyệt chặn âm thanh — báo động đỏ trên màn hình vẫn còn
  }
}

export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // trình duyệt từ chối — thử cách cũ bên dưới
    }
  }
  try {
    const box = document.createElement('textarea')
    box.value = text
    box.setAttribute('readonly', '')
    box.style.position = 'fixed'
    box.style.top = '0'
    box.style.left = '0'
    box.style.opacity = '0'
    document.body.appendChild(box)
    box.focus()
    box.select()
    box.setSelectionRange(0, text.length)
    const done = document.execCommand('copy')
    document.body.removeChild(box)
    return done
  } catch {
    return false
  }
}
