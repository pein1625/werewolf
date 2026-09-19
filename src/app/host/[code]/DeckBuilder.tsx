'use client'

import { useRef, useState } from 'react'
import type { RoleId } from '@/game/roles'
import { ROLES, ROLE_LIST } from '@/game/roles'
import { RoleArt } from '@/components/RoleArt'

type Counts = Partial<Record<RoleId, number>>

type Drag = {
  roleId: RoleId
  from: 'pool' | 'table'
  x: number
  y: number
  startX: number
  startY: number
  moved: boolean
}

function CardFace({
  roleId,
  size = 'md',
  badge,
  dimmed,
}: {
  roleId: RoleId
  size?: 'sm' | 'md'
  badge?: number
  dimmed?: boolean
}) {
  const role = ROLES[roleId]
  const wolf = role.team === 'WOLF'
  return (
    <div
      className={`relative flex flex-col items-center justify-between rounded-xl border px-1.5 ${
        size === 'sm' ? 'py-1.5' : 'py-2'
      } ${dimmed ? 'opacity-35' : ''}`}
      style={{
        aspectRatio: '3 / 4',
        borderColor: wolf ? 'var(--color-blood-dim)' : 'var(--color-edge)',
        background: wolf
          ? 'linear-gradient(165deg, rgba(214,69,80,0.30), rgba(10,11,16,0.9))'
          : 'linear-gradient(165deg, rgba(75,165,133,0.26), rgba(10,11,16,0.9))',
      }}
    >
      <RoleArt
        roleId={roleId}
        className={size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'}
      />
      <span
        className={`w-full text-center leading-tight font-semibold ${
          size === 'sm' ? 'text-[10px]' : 'text-[11px]'
        }`}
        style={{ color: wolf ? '#ffd9dc' : '#bdf0dd' }}
      >
        {role.name}
      </span>
      {badge ? (
        <span className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gold text-xs font-bold text-[#1a1406]">
          {badge}
        </span>
      ) : null}
    </div>
  )
}

export function DeckBuilder({
  counts,
  playerCount,
  onChange,
}: {
  counts: Counts
  playerCount: number
  onChange: (next: Counts) => void
}) {
  const tableRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)

  const total = Object.values(counts).reduce<number>((s, n) => s + (n ?? 0), 0)
  const deck: RoleId[] = []
  for (const role of ROLE_LIST) {
    for (let i = 0; i < (counts[role.id] ?? 0); i++) deck.push(role.id)
  }

  function add(roleId: RoleId) {
    const max = ROLES[roleId].max
    const now = counts[roleId] ?? 0
    if (max !== null && now >= max) return
    onChange({ ...counts, [roleId]: now + 1 })
  }

  function remove(roleId: RoleId) {
    const now = counts[roleId] ?? 0
    if (now <= 1) {
      const next = { ...counts }
      delete next[roleId]
      return onChange(next)
    }
    onChange({ ...counts, [roleId]: now - 1 })
  }

  function overTable(x: number, y: number): boolean {
    const box = tableRef.current?.getBoundingClientRect()
    if (!box) return false
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
  }

  function handlers(roleId: RoleId, from: 'pool' | 'table') {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        setDrag({
          roleId,
          from,
          x: e.clientX,
          y: e.clientY,
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
        })
      },
      onPointerMove: (e: React.PointerEvent) => {
        setDrag((d) => {
          if (!d) return d
          const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY)
          return { ...d, x: e.clientX, y: e.clientY, moved: d.moved || dist > 8 }
        })
      },
      onPointerUp: (e: React.PointerEvent) => {
        const d = drag
        setDrag(null)
        if (!d) return
        const onTable = overTable(e.clientX, e.clientY)
        if (!d.moved) {
          if (from === 'pool') add(roleId)
          else remove(roleId)
          return
        }
        if (from === 'pool' && onTable) add(roleId)
        if (from === 'table' && !onTable) remove(roleId)
      },
      onPointerCancel: () => setDrag(null),
    }
  }

  const dragging = drag?.moved ? drag : null
  const armed = dragging?.from === 'pool'

  return (
    <div className="space-y-3">
      <div
        ref={tableRef}
        className="panel p-3 transition"
        style={{
          borderColor: armed ? 'var(--color-gold)' : undefined,
          background: armed ? 'rgba(227,179,65,0.08)' : undefined,
        }}
      >
        <div className="flex items-center justify-between">
          <p className="label">Bàn — bộ bài sẽ chia</p>
          <p className="text-sm">
            <span className={total === playerCount ? 'text-pine' : 'text-blood'}>
              {total}
            </span>
            <span className="text-mist"> / {playerCount} lá</span>
          </p>
        </div>

        {deck.length === 0 ? (
          <p className="py-8 text-center text-sm text-mist">
            Kéo lá từ kho bên dưới thả vào đây.
            <br />
            <span className="text-xs">Hoặc chạm vào lá để thêm nhanh.</span>
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-6">
            {deck.map((roleId, i) => (
              <div
                key={`${roleId}-${i}`}
                className="cursor-grab touch-none select-none active:cursor-grabbing"
                {...handlers(roleId, 'table')}
              >
                <CardFace roleId={roleId} size="sm" />
              </div>
            ))}
          </div>
        )}
        {deck.length ? (
          <p className="mt-2 text-center text-[11px] text-mist">
            Chạm một lá trên bàn để bỏ ra, hoặc kéo nó ra ngoài.
          </p>
        ) : null}
      </div>

      <div className="panel p-3">
        <p className="label">Kho bài</p>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
          {ROLE_LIST.map((role) => {
            const n = counts[role.id] ?? 0
            const maxed = role.max !== null && n >= role.max
            return (
              <div
                key={role.id}
                className={`touch-none select-none ${maxed ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
                title={role.summary}
                {...(maxed ? {} : handlers(role.id, 'pool'))}
              >
                <CardFace roleId={role.id} badge={n || undefined} dimmed={maxed} />
              </div>
            )
          })}
        </div>
      </div>

      {dragging ? (
        <div
          className="pointer-events-none fixed z-50 w-16 opacity-90"
          style={{ left: dragging.x, top: dragging.y, transform: 'translate(-50%, -50%) rotate(-4deg)' }}
        >
          <CardFace roleId={dragging.roleId} />
        </div>
      ) : null}
    </div>
  )
}
