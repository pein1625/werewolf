'use client'

import { useState } from 'react'
import type { RoleId } from '@/game/roles'

export function RoleImage({
  roleId,
  className = '',
  fallback,
}: {
  roleId: RoleId
  className?: string
  fallback: React.ReactNode
}) {
  const [missing, setMissing] = useState<RoleId | null>(null)

  if (missing === roleId) return <>{fallback}</>

  return (
    <img
      src={`/roles/${roleId}.png`}
      alt=""
      className={className}
      draggable={false}
      onError={() => setMissing(roleId)}
    />
  )
}
