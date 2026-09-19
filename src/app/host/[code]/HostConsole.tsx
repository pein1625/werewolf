'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { HostView } from '@/game/views'
import { ROLES } from '@/game/roles'
import { copyText, emit, formatClock, useCountdown } from '@/lib/useRoom'
import { SetupPanel } from './SetupPanel'
import { StepPanel } from './StepPanel'

const PHASE_LABEL: Record<string, string> = {
  LOBBY: 'Phòng chờ',
  DEALING: 'Đã chia bài',
  NIGHT: 'Đêm',
  DAY_REVEAL: 'Trời sáng',
  DAY_DISCUSS: 'Thảo luận',
  DAY_VOTE: 'Bỏ phiếu',
  ENDED: 'Kết thúc',
}

const WINNER_TEXT: Record<string, string> = {
  WOLF: 'Phe Sói thắng',
  VILLAGE: 'Phe Dân thắng',
  LOVERS: 'Đôi tình nhân thắng',
  NOBODY: 'Không ai thắng',
}

const IN_GAME = ['NIGHT', 'DAY_REVEAL', 'DAY_DISCUSS', 'DAY_VOTE']

function JoinCard({ code }: { code: string }) {
  const [qr, setQr] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle')

  useEffect(() => {
    if (copied === 'idle') return
    const id = setTimeout(() => setCopied('idle'), 2000)
    return () => clearTimeout(id)
  }, [copied])

  useEffect(() => {
    const link = `${window.location.origin}/play/${code}`
    setUrl(link)
    QRCode.toDataURL(link, { width: 480, margin: 1, color: { dark: '#0a0b10', light: '#e8ecff' } })
      .then(setQr)
      .catch(() => setQr(null))
  }, [code])

  return (
    <div className="panel p-5 text-center">
      <p className="label">Cho cả bàn quét hoặc gõ mã</p>
      <p className="mt-2 font-mono text-5xl font-bold tracking-[0.25em] text-gold">{code}</p>
      {qr ? <img src={qr} alt="QR vào phòng" className="mx-auto mt-4 w-48 rounded-xl" /> : null}
      <p className="mt-3 break-all text-xs text-mist">{url}</p>
      <button
        className={`btn mt-3 w-full transition-colors ${
          copied === 'ok' ? 'btn-copied' : copied === 'fail' ? 'btn-copy-failed' : ''
        }`}
        onClick={async () => setCopied((await copyText(url)) ? 'ok' : 'fail')}
      >
        {copied === 'ok' ? (
          <>
            <span className="tick">✓</span> Đã copy link
          </>
        ) : copied === 'fail' ? (
          'Trình duyệt chặn copy — chạm giữ vào link ở trên'
        ) : (
          'Copy link'
        )}
      </button>

      <details className="mt-3 text-left">
        <summary className="cursor-pointer text-xs text-mist">Test một mình trên cùng máy</summary>
        <p className="mt-2 text-xs text-mist">
          Mỗi link là một người chơi riêng, mở được cùng lúc trong nhiều tab của cùng trình duyệt.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((slot) => (
            <a
              key={slot}
              className="btn px-2.5 py-1 text-xs"
              href={`/play/${code}?p=${slot}`}
              target="_blank"
              rel="noreferrer"
            >
              Người {slot}
            </a>
          ))}
        </div>
      </details>
    </div>
  )
}

function TimerBar({ view }: { view: HostView }) {
  const seconds = useCountdown(view.timer?.remainingSec, view.timer?.running)
  const [custom, setCustom] = useState('')
  if (!view.timer) return null
  const expired = seconds <= 0 && !view.timer.running

  return (
    <div className={`panel px-3 py-2 ${expired ? 'alarm' : ''}`}>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-mist">⏱</span>
        <span className="font-mono tabular-nums">{formatClock(seconds)}</span>
        <span className={expired ? 'font-semibold text-blood' : 'text-xs text-mist'}>
          {expired ? 'HẾT GIỜ' : PHASE_LABEL[view.timer.phase]}
        </span>
        <div className="ml-auto flex gap-1">
          {view.timer.running ? (
            <button className="btn px-2 py-1 text-xs" onClick={() => emit('host:timer', { op: 'pause' })}>
              ⏸
            </button>
          ) : (
            <button className="btn px-2 py-1 text-xs" onClick={() => emit('host:timer', { op: 'start' })}>
              ▶
            </button>
          )}
          <button className="btn px-2 py-1 text-xs" onClick={() => emit('host:timer', { op: 'reset' })}>
            ↺
          </button>
        </div>
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer text-xs text-mist">Chỉnh giờ</summary>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {[30, 60, -30].map((d) => (
            <button
              key={d}
              className="btn px-2.5 py-1 text-xs"
              onClick={() => emit('host:timer', { op: 'add', seconds: d })}
            >
              {d > 0 ? `+${d}s` : `${d}s`}
            </button>
          ))}
          <input
            className="input w-20 px-2 py-1 text-xs"
            placeholder="giây"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <button
            className="btn px-2.5 py-1 text-xs"
            onClick={() => {
              const seconds = Number(custom)
              if (seconds > 0) emit('host:timer', { op: 'set', seconds })
              setCustom('')
            }}
          >
            Đặt riêng
          </button>
        </div>
      </details>
    </div>
  )
}

function PlayerGrid({ view, open }: { view: HostView; open: boolean }) {
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const inLobby = view.phase === 'LOBBY'

  const body = (
    <>
      {view.players.length === 0 ? (
        <p className="mt-3 text-sm text-mist">Chưa ai vào. Chia mã hoặc QR ở trên.</p>
      ) : null}
      <ul className="mt-3 space-y-1.5">
        {view.players.map((p) => (
          <li key={p.id}>
            <button
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                p.alive
                  ? 'border-edge bg-ink'
                  : 'border-transparent bg-ink/40 text-mist'
              }`}
              onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
            >
              <span className="w-5 text-xs text-mist">{p.seat}</span>
              <span className={p.alive ? '' : 'line-through'}>{p.name}</span>
              {p.isLover ? <span title="đôi tình nhân">💘</span> : null}
              {p.converted ? <span title="bị biến thành sói">🔄</span> : null}
              <span className="ml-auto shrink-0 text-xs">
                {p.roleName ? (
                  <span
                    className={
                      p.roleId && ROLES[p.roleId].team === 'WOLF'
                        ? 'text-blood'
                        : 'text-pine'
                    }
                  >
                    {p.roleName}
                  </span>
                ) : (
                  <span className="text-mist">chưa có bài</span>
                )}
              </span>
            </button>
            {menuFor === p.id ? (
              <div className="mt-1 flex flex-wrap gap-1.5 pl-8">
                {p.alive ? (
                  <button
                    className="btn btn-danger px-2.5 py-1 text-xs"
                    onClick={() => {
                      emit('host:manualDeath', { playerId: p.id })
                      setMenuFor(null)
                    }}
                  >
                    Cho chết
                  </button>
                ) : (
                  <button
                    className="btn px-2.5 py-1 text-xs"
                    onClick={() => {
                      emit('host:revive', { playerId: p.id })
                      setMenuFor(null)
                    }}
                  >
                    Hồi sinh
                  </button>
                )}
                <button
                  className="btn px-2.5 py-1 text-xs"
                  onClick={() => {
                    const name = prompt('Tên mới', p.name)
                    if (name) emit('host:renamePlayer', { playerId: p.id, name })
                    setMenuFor(null)
                  }}
                >
                  Đổi tên
                </button>
                {inLobby ? (
                  <button
                    className="btn px-2.5 py-1 text-xs"
                    onClick={() => {
                      emit('host:removePlayer', { playerId: p.id })
                      setMenuFor(null)
                    }}
                  >
                    Xoá khỏi phòng
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  )

  if (open) {
    return (
      <div className="panel p-4">
        <div className="flex items-center justify-between">
          <p className="label">Người chơi</p>
          <p className="text-xs text-mist">
            {view.aliveCount}/{view.players.length} sống · {view.wolvesAlive} sói
          </p>
        </div>
        {body}
      </div>
    )
  }

  return (
    <details className="panel p-4">
      <summary className="flex cursor-pointer items-center justify-between">
        <span className="label">Bàn chơi &amp; bài của từng người</span>
        <span className="text-xs text-mist">
          {view.aliveCount}/{view.players.length} sống · {view.wolvesAlive} sói
        </span>
      </summary>
      {body}
    </details>
  )
}

function DeathLog({ view }: { view: HostView }) {
  if (!view.deaths.length) return null
  return (
    <details className="panel p-4">
      <summary className="cursor-pointer label">Lịch sử — ai chết, vì sao ({view.deaths.length})</summary>
      <ol className="mt-3 space-y-2">
        {view.deaths.map((d, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 shrink-0 rounded-md bg-ink px-2 py-0.5 text-xs text-mist">
              {d.phase === 'NIGHT' ? `Đêm ${d.round}` : `Ngày ${d.round}`}
            </span>
            <span>
              <strong>{d.name}</strong> — {d.causeLabel}
              {d.byPlayerId ? (
                <span className="text-mist">
                  {' '}
                  (bởi {view.players.find((p) => p.id === d.byPlayerId)?.name ?? '—'})
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </details>
  )
}

export function HostConsole({ view }: { view: HostView }) {
  const inGame = IN_GAME.includes(view.phase)

  return (
    <main className="mx-auto max-w-lg space-y-3 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="label">Bảng quản trò · {view.code}</p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
            {PHASE_LABEL[view.phase]}
            {inGame ? ` ${view.round}` : ''}
          </h1>
        </div>
        <button
          className="btn px-3 py-2 text-sm"
          disabled={!view.canUndo}
          onClick={() => emit('host:undo')}
          title="Quay lại bước trước"
        >
          ↩ Lùi một bước
        </button>
      </header>

      {view.winner && view.phase !== 'ENDED' ? (
        <div className="panel border-gold bg-gold/10 p-4 text-center">
          <p className="text-lg font-bold">🏆 {WINNER_TEXT[view.winner]}</p>
          <p className="mt-1 text-xs text-mist">
            Điều kiện thắng đã thoả. Bấm kết thúc để lật bài cả bàn.
          </p>
          <button
            className="btn btn-primary mt-3 w-full"
            onClick={() => emit('host:end', { winner: view.winner })}
          >
            Kết thúc ván
          </button>
        </div>
      ) : null}

      {view.phase === 'LOBBY' ? (
        <>
          <JoinCard code={view.code} />
          <PlayerGrid view={view} open />
          <SetupPanel view={view} />
        </>
      ) : null}

      {view.phase === 'DEALING' ? (
        <>
          <div className="panel p-5 text-center">
            <p className="text-3xl">🎴</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-xl font-bold">
              Bài đã chia xong
            </p>
            <p className="mt-2 text-sm text-mist">
              Mọi người xem lá của mình trên điện thoại rồi úp máy xuống.
            </p>
            <button className="btn btn-primary mt-4 w-full py-4 text-base" onClick={() => emit('host:start')}>
              Bắt đầu đêm đầu tiên
            </button>
          </div>
          <PlayerGrid view={view} open={false} />
        </>
      ) : null}

      {inGame ? (
        <>
          <StepPanel view={view} />
          <TimerBar view={view} />
          <PlayerGrid view={view} open={false} />
          <DeathLog view={view} />
          <button
            className="btn btn-ghost w-full text-xs text-mist"
            onClick={() => emit('host:end', { winner: view.winner ?? 'NOBODY' })}
          >
            Kết thúc ván sớm
          </button>
        </>
      ) : null}

      {view.phase === 'ENDED' ? (
        <>
          <div className="panel border-gold bg-gold/10 p-5 text-center">
            <p className="text-4xl">🏆</p>
            <p className="mt-2 text-2xl font-bold">
              {view.winner ? WINNER_TEXT[view.winner] : 'Ván kết thúc'}
            </p>
          </div>
          <PlayerGrid view={view} open />
          <DeathLog view={view} />
          <a className="btn w-full" href="/">
            Về trang chủ — tạo ván mới
          </a>
        </>
      ) : null}
    </main>
  )
}
