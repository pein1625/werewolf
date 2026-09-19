'use client'

import { useEffect, useState } from 'react'
import type { HostView } from '@/game/views'
import { ROLES } from '@/game/roles'
import { emit } from '@/lib/useRoom'

function AnswerToGive({ view }: { view: HostView }) {
  const targetId = view.pendingNight.SEER_INSPECT[0]
  const target = view.players.find((p) => p.id === targetId)
  if (!target) {
    return (
      <p className="mt-3 rounded-xl border border-edge bg-ink px-4 py-3 text-sm text-mist">
        Tiên tri không soi ai. Không cần trả lời gì.
      </p>
    )
  }
  const wolf = target.roleId ? ROLES[target.roleId].team === 'WOLF' : false
  return (
    <div
      className="mt-3 rounded-xl border px-4 py-4 text-center"
      style={{
        borderColor: wolf ? 'var(--color-blood)' : 'var(--color-pine)',
        background: wolf ? 'rgba(214,69,80,0.15)' : 'rgba(75,165,133,0.15)',
      }}
    >
      <p className="text-xs text-mist">Tiên tri soi {target.name} — trả lời</p>
      <p className="mt-1 text-3xl font-bold" style={{ color: wolf ? 'var(--color-blood)' : 'var(--color-pine)' }}>
        {wolf ? '👍 LÀ SÓI' : '👎 KHÔNG PHẢI SÓI'}
      </p>
    </div>
  )
}

function WolfSeerAnswer({ view }: { view: HostView }) {
  const targetId = view.pendingNight.WOLF_SEER_INSPECT[0]
  const target = view.players.find((p) => p.id === targetId)
  if (!target) {
    return (
      <p className="mt-3 rounded-xl border border-edge bg-ink px-4 py-3 text-sm text-mist">
        Sói tiên tri không soi ai.
      </p>
    )
  }
  return (
    <div className="mt-3 rounded-xl border border-gold bg-gold/15 px-4 py-4 text-center">
      <p className="text-xs text-mist">Sói tiên tri soi {target.name} — trả lời</p>
      <p className="mt-1 text-3xl font-bold text-gold">
        {target.roleName ?? '—'}
      </p>
    </div>
  )
}

export function StepPanel({ view }: { view: HostView }) {
  const step = view.step
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSelected([])
    setError(null)
  }, [step?.id, view.round, view.phase])

  if (!step) return null

  const max = step.count ?? 1
  const targets = (step.targetIds ?? [])
    .map((id) => view.players.find((p) => p.id === id))
    .filter((p): p is HostView['players'][number] => Boolean(p))

  async function send(payload: { targetIds?: string[]; answer?: 'yes' | 'no' }) {
    if (!step) return
    setBusy(true)
    const res = await emit('host:step', { stepId: step.id, ...payload })
    setBusy(false)
    setError(res.ok ? null : res.error)
    if (res.ok) setSelected([])
  }

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (max === 1) return [id]
      if (prev.length >= max) return [...prev.slice(1), id]
      return [...prev, id]
    })
  }

  const isHunter = step.id === 'hunter'

  return (
    <section className="space-y-3">
      <div
        className="panel overflow-hidden"
        style={{ borderColor: isHunter ? 'var(--color-blood)' : 'var(--color-gold)' }}
      >
        <div
          className="px-5 py-5"
          style={{
            background: isHunter
              ? 'linear-gradient(180deg, rgba(214,69,80,0.25), transparent)'
              : 'linear-gradient(180deg, rgba(227,179,65,0.18), transparent)',
          }}
        >
          {!isHunter ? (
            <p className="label">
              Bước {view.stepIndex + 1}/{view.stepCount}
            </p>
          ) : (
            <p className="label text-blood">Phải xử lý ngay</p>
          )}
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl leading-snug font-bold">
            {step.speech}
          </p>
          {step.hint ? <p className="mt-2 text-sm text-mist">{step.hint}</p> : null}
          {step.note ? (
            <p className="mt-2 rounded-lg bg-ink px-3 py-2 text-xs text-mist">
              {step.note}
            </p>
          ) : null}
        </div>

        <div className="border-t border-edge px-5 py-4">
          {step.id === 'seer-answer' ? <AnswerToGive view={view} /> : null}
          {step.id === 'wolfseer-answer' ? <WolfSeerAnswer view={view} /> : null}

          {step.kind === 'pick' ? (
            <>
              {max > 1 ? (
                <p className="mb-2 text-xs text-mist">
                  Đã chọn {selected.length}/{max}
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                {targets.map((p) => {
                  const on = selected.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      className={`flex min-h-16 items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition ${
                        on
                          ? 'border-gold bg-gold/25'
                          : 'border-edge bg-ink hover:border-gold/60'
                      }`}
                      onClick={() => toggle(p.id)}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
                          on ? 'bg-gold text-[#1a1406]' : 'bg-ink-3 text-mist'
                        }`}
                      >
                        {p.seat}
                      </span>
                      <span className="min-w-0 truncate text-lg leading-tight font-semibold">{p.name}</span>
                    </button>
                  )
                })}
                {targets.length === 0 ? (
                  <p className="col-span-2 text-sm text-mist">Không còn ai hợp lệ để chọn.</p>
                ) : null}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  className="btn btn-primary flex-1 py-3.5 text-base"
                  disabled={busy || selected.length !== max}
                  onClick={() => send({ targetIds: selected })}
                >
                  Xác nhận
                </button>
                {step.skipLabel ? (
                  <button
                    className="btn flex-1 py-3.5"
                    disabled={busy}
                    onClick={() => send({ targetIds: [] })}
                  >
                    {step.skipLabel}
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {step.kind === 'confirm' ? (
            <div className="flex gap-2">
              <button
                className="btn btn-primary flex-1 py-3.5 text-base"
                disabled={busy || !step.confirmTargetId}
                onClick={() => send({ answer: 'yes' })}
              >
                {step.confirmLabel ?? 'Có'}
              </button>
              <button
                className="btn flex-1 py-3.5 text-base"
                disabled={busy}
                onClick={() => send({ answer: 'no' })}
              >
                {step.denyLabel ?? 'Không'}
              </button>
            </div>
          ) : null}

          {step.kind === 'announce' ? (
            <button
              className="btn btn-primary w-full py-4 text-base"
              disabled={busy}
              onClick={() => send({})}
            >
              {step.cta ?? 'Tiếp theo'}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-blood-dim bg-blood-dim/20 px-4 py-2.5 text-sm">
          {error}
        </p>
      ) : null}
    </section>
  )
}
