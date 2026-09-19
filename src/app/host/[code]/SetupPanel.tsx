'use client'

import { useEffect, useMemo, useState } from 'react'
import type { HostView } from '@/game/views'
import type { RoleId } from '@/game/roles'
import { DeckBuilder } from './DeckBuilder'
import { autoBalance, countRoles, fitPackTo, packsFor, validateSetup, wolfCount } from '@/game/packs'
import { DEFAULT_TIMERS } from '@/game/events'
import { emit } from '@/lib/useRoom'

type Counts = Partial<Record<RoleId, number>>

export function SetupPanel({ view }: { view: HostView }) {
  const playerCount = view.players.length
  const [counts, setCounts] = useState<Counts>(view.roleCounts)
  const [timers, setTimers] = useState(view.timers ?? DEFAULT_TIMERS)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) setCounts(view.roleCounts)
  }, [view.roleCounts, dirty])

  const issues = useMemo(
    () => (playerCount < 4 ? [] : validateSetup(counts, playerCount)),
    [counts, playerCount],
  )
  const total = countRoles(counts)
  const wolves = wolfCount(counts)
  const blocking = issues.filter((i) => i.level === 'error')
  const packs = packsFor(playerCount)

  async function save(nextCounts: Counts = counts, nextTimers = timers) {
    const res = await emit('host:setup', { roleCounts: nextCounts, timers: nextTimers })
    setError(res.ok ? null : res.error)
    if (res.ok) setDirty(false)
  }

  async function deal() {
    await save()
    const res = await emit('host:deal')
    setError(res.ok ? null : res.error)
  }

  return (
    <section className="space-y-4">
      {packs.length ? (
        <div className="panel p-4">
          <p className="label">Pack gợi ý cho {playerCount} người</p>
          <div className="mt-3 grid gap-2">
            {packs.map((pack) => (
              <button
                key={pack.id}
                className="btn btn-ghost flex-col items-start text-left"
                onClick={() => {
                  const fitted = fitPackTo(pack, playerCount)
                  setDirty(true)
                  setCounts(fitted)
                }}
              >
                <span className="font-semibold">{pack.name}</span>
                <span className="text-xs font-normal text-mist">{pack.blurb}</span>
              </button>
            ))}
            <button
              className="btn btn-ghost"
              onClick={() => {
                setDirty(true)
                setCounts(autoBalance(playerCount))
              }}
            >
              Tự cân bằng theo sĩ số
            </button>
          </div>
        </div>
      ) : (
        <div className="panel p-4">
          <p className="text-sm text-mist">
            {playerCount < 4
              ? `Đang chờ người vào — mới có ${playerCount} người, cần ít nhất 4 để chia bài.`
              : `Chưa có pack nào hợp ${playerCount} người. Bấm tự cân bằng hoặc chỉnh tay bên dưới.`}
          </p>
          <button
            className="btn mt-3 w-full"
            onClick={() => {
              setDirty(true)
              setCounts(autoBalance(Math.max(4, playerCount)))
            }}
          >
            Tự cân bằng
          </button>
        </div>
      )}

      <DeckBuilder
        counts={counts}
        playerCount={playerCount}
        onChange={(next) => {
          setDirty(true)
          setCounts(next)
        }}
      />

      <p className="text-center text-xs text-mist">
        {wolves} sói · {total - wolves} phe dân
      </p>

      <div className="panel p-4">
        <p className="label">Bộ đếm thời gian mỗi bước (giây)</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(
            [
              ['NIGHT', 'Đêm'],
              ['DAY_REVEAL', 'Công bố'],
              ['DAY_DISCUSS', 'Thảo luận'],
              ['DAY_VOTE', 'Bỏ phiếu'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-xs text-mist">{label}</span>
              <input
                className="input mt-1"
                type="number"
                min={5}
                max={3600}
                value={timers[key]}
                onChange={(e) => {
                  const next = { ...timers, [key]: Math.max(5, Number(e.target.value) || 5) }
                  setTimers(next)
                  setDirty(true)
                }}
              />
            </label>
          ))}
        </div>
      </div>

      {issues.length ? (
        <ul className="space-y-2">
          {issues.map((issue, i) => (
            <li
              key={i}
              className={`rounded-xl border px-4 py-2.5 text-sm ${
                issue.level === 'error'
                  ? 'border-blood-dim bg-blood-dim/20'
                  : 'border-gold/40 bg-gold/10'
              }`}
            >
              {issue.level === 'error' ? '⛔ ' : '⚠️ '}
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-blood-dim bg-blood-dim/20 px-4 py-2.5 text-sm">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button className="btn flex-1" onClick={() => save()} disabled={!dirty}>
          Lưu bộ bài
        </button>
        <button
          className="btn btn-primary flex-1"
          onClick={deal}
          disabled={blocking.length > 0 || playerCount < 4}
        >
          Chia bài
        </button>
      </div>
    </section>
  )
}
