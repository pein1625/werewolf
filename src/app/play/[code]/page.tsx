'use client'

import { use, useCallback, useEffect, useState } from 'react'
import type { PlayerView } from '@/game/views'
import { emit, useRoomState } from '@/lib/useRoom'
import { RoleArt } from '@/components/RoleArt'

const WINNER_TEXT: Record<string, string> = {
  WOLF: 'Phe Sói thắng',
  VILLAGE: 'Phe Dân thắng',
  LOVERS: 'Đôi tình nhân thắng',
  NOBODY: 'Không ai thắng',
}

function playerKey(code: string): string {
  const slot = new URLSearchParams(window.location.search).get('p')?.slice(0, 8) || '1'
  return `ww:player:${code}:${slot}`
}

export default function PlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const roomCode = code.toUpperCase()
  const [name, setName] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [hasToken, setHasToken] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setHasToken(Boolean(localStorage.getItem(playerKey(roomCode))))
  }, [roomCode])

  const connect = useCallback(async () => {
    const token = localStorage.getItem(playerKey(roomCode))
    if (!token) return { ok: false as const, error: '' }
    const res = await emit('player:join', { code: roomCode, playerToken: token })
    if (res.ok) localStorage.setItem(playerKey(roomCode), res.playerToken as string)
    return res
  }, [roomCode])

  const { state, error } = useRoomState<PlayerView>(connect)

  async function submitName(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setJoinError(null)
    const res = await emit('player:join', { code: roomCode, name: name.trim() })
    setBusy(false)
    if (!res.ok) return setJoinError(res.error)
    localStorage.setItem(playerKey(roomCode), res.playerToken as string)
    setHasToken(true)
  }

  if (hasToken === null) return <Splash text="Đang mở phòng…" />

  if (!state) {
    if (!hasToken || error) {
      return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-12">
          <header className="text-center">
            <p className="text-4xl">🐺</p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">
              Phòng {roomCode}
            </h1>
            <p className="mt-1 text-sm text-mist">Đặt tên để cả bàn gọi bạn.</p>
          </header>
          {joinError || error ? (
            <p className="rounded-xl border border-blood-dim bg-blood-dim/20 px-4 py-3 text-sm">
              {joinError || error}
            </p>
          ) : null}
          <form className="panel p-5" onSubmit={submitName}>
            <input
              className="input text-center text-lg"
              placeholder="Tên của bạn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              autoFocus
            />
            <button className="btn btn-primary mt-3 w-full" type="submit" disabled={busy}>
              {busy ? 'Đang vào…' : 'Vào bàn'}
            </button>
          </form>
        </main>
      )
    }
    return <Splash text="Đang kết nối…" />
  }

  if (state.phase === 'ENDED') return <EndScreen view={state} />
  if (!state.you.role) return <LobbyScreen view={state} />
  return <CardScreen view={state} />
}

function Splash({ text }: { text: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center text-sm text-mist">
      {text}
    </main>
  )
}

function LobbyScreen({ view }: { view: PlayerView }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-10 text-center">
      <p className="text-5xl">🕯️</p>
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
          Đang chờ chia bài
        </h1>
        <p className="mt-2 text-sm text-mist">
          Bạn là <strong className="text-moon">{view.you.name}</strong> · phòng {view.code}
        </p>
      </div>
      <div className="panel p-4">
        <p className="label">{view.playerCount} người đã vào</p>
        <p className="mt-2 text-sm text-mist">{view.lobbyNames.join(' · ')}</p>
      </div>
    </main>
  )
}

function CardScreen({ view }: { view: PlayerView }) {
  const role = view.you.role
  const alive = view.you.alive
  const wolf = role?.team === 'WOLF'
  const accent = wolf ? 'var(--color-blood)' : 'var(--color-pine)'
  const frame = wolf ? 'var(--color-blood-dim)' : 'rgba(75,165,133,0.55)'
  const statusColor = alive ? 'var(--color-pine)' : 'var(--color-blood)'

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-5">
      <div className="flex items-center justify-between text-xs">
        <span className="truncate text-mist">
          <span className="text-moon">{view.you.name}</span> · ghế {view.you.seat}
        </span>
        <span className="flex shrink-0 items-center gap-1.5" style={{ color: statusColor }}>
          <span className="h-2 w-2 rounded-full" style={{ background: statusColor }} />
          {alive ? 'Còn sống' : 'Đã chết'}
        </span>
      </div>

      <div className="relative mx-auto w-full max-w-[310px]">
        <div
          className="relative overflow-hidden rounded-2xl border-2 shadow-2xl"
          style={{
            aspectRatio: '5 / 7',
            borderColor: frame,
            background: wolf
              ? 'radial-gradient(125% 85% at 50% 0%, rgba(214,69,80,0.34), #0a0b10 68%)'
              : 'radial-gradient(125% 85% at 50% 0%, rgba(75,165,133,0.30), #0a0b10 68%)',
            filter: alive ? undefined : 'grayscale(0.7)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-2.5 rounded-xl border"
            style={{ borderColor: frame, opacity: 0.55 }}
          />

          {role ? (
            <>
              <div className="absolute top-4 left-4" style={{ color: accent }}>
                <RoleArt roleId={role.id} className="h-5 w-5 opacity-70" />
              </div>
              <div className="absolute right-4 bottom-4 rotate-180" style={{ color: accent }}>
                <RoleArt roleId={role.id} className="h-5 w-5 opacity-70" />
              </div>

              <div className="relative flex h-full flex-col items-center justify-center gap-3 px-7 pb-10 text-center">
                <div style={{ color: accent }}>
                  <RoleArt roleId={role.id} className="h-24 w-24" />
                </div>
                <h1 className="font-[family-name:var(--font-display)] text-4xl leading-none font-bold">
                  {role.name}
                </h1>
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase"
                  style={{
                    background: wolf ? 'var(--color-blood-dim)' : 'rgba(75,165,133,0.28)',
                    color: wolf ? '#ffd9dc' : '#bdf0dd',
                  }}
                >
                  {wolf ? 'Phe Sói' : 'Phe Dân'}
                </span>
                <p className="text-sm leading-relaxed text-moon/85">{role.summary}</p>
              </div>
            </>
          ) : null}

          {!alive ? (
            <>
              <div className="pointer-events-none absolute inset-0 bg-ink/45" />
              <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
                <p
                  className="-rotate-6 rounded-lg border-4 px-5 py-1.5 text-2xl font-black tracking-widest"
                  style={{
                    borderColor: 'var(--color-blood)',
                    color: 'var(--color-blood)',
                    background: 'rgba(10,11,16,0.75)',
                  }}
                >
                  ĐÃ CHẾT
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {!alive ? (
        <p className="text-center text-xs text-mist">
          {view.you.deathCauseLabel}. Giữ im lặng, đừng ra hiệu cho ai.
        </p>
      ) : null}

      {view.allies.length ? (
        <section className="panel px-4 py-3">
          <p className="label">Đồng bọn của bạn</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {view.allies.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-blood-dim bg-blood-dim/20 px-3 py-1.5 text-sm"
              >
                🐺 {a.name} <span className="text-mist">· {a.roleName}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view.you.isLover && view.you.loverName ? (
        <section className="panel border-pink-500/40 bg-pink-500/10 px-4 py-3">
          <p className="label">Đôi tình nhân</p>
          <p className="mt-1 text-sm">
            💘 Bạn và <strong>{view.you.loverName}</strong> là một đôi. Một người chết, người kia chết
            theo.
          </p>
        </section>
      ) : null}

      {view.elderBitten ? (
        <section className="panel border-gold/40 bg-gold/10 px-4 py-3">
          <p className="text-sm">🩸 Bạn đã bị sói cắn một lần và sống sót. Lần sau thì không.</p>
        </section>
      ) : null}

      {role ? (
        <details className="panel px-4 py-3">
          <summary className="cursor-pointer label">Luật của lá này</summary>
          <p className="mt-2 text-sm leading-relaxed text-mist">{role.detail}</p>
        </details>
      ) : null}
    </main>
  )
}

function EndScreen({ view }: { view: PlayerView }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6">
      <div className="panel border-gold bg-gold/10 px-4 py-6 text-center">
        <p className="text-4xl">🏆</p>
        <p className="mt-2 text-2xl font-bold">
          {view.winner ? WINNER_TEXT[view.winner] : 'Ván kết thúc'}
        </p>
        <p className="mt-1 text-sm text-mist">
          Bạn là {view.you.role?.name ?? '—'} · {view.you.alive ? 'sống tới cuối' : view.you.deathCauseLabel}
        </p>
      </div>

      <section className="panel p-4">
        <p className="label">Lật bài cả bàn</p>
        <ul className="mt-3 space-y-1.5">
          {view.reveal.map((r) => (
            <li
              key={r.seat}
              className="flex items-center gap-2 rounded-lg border border-edge bg-ink px-3 py-2 text-sm"
            >
              <span className="w-5 text-xs text-mist">{r.seat}</span>
              <span className={r.alive ? '' : 'text-mist line-through'}>{r.name}</span>
              <span
                className="ml-auto text-xs"
                style={{ color: r.team === 'WOLF' ? 'var(--color-blood)' : 'var(--color-pine)' }}
              >
                {r.roleName}
              </span>
            </li>
          ))}
        </ul>
        <ul className="mt-3 space-y-1 text-xs text-mist">
          {view.reveal
            .filter((r) => !r.alive)
            .map((r) => (
              <li key={`d-${r.seat}`}>
                {r.name} — {r.deathCauseLabel}
              </li>
            ))}
        </ul>
      </section>
    </main>
  )
}
