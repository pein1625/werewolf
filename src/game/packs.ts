import type { RoleId } from './roles'
import { ROLES } from './roles'

export type Pack = {
  id: string
  name: string
  minPlayers: number
  maxPlayers: number
  blurb: string
  roles: Partial<Record<RoleId, number>>
}

export const PACKS: Pack[] = [
  {
    id: 'starter',
    name: 'Nhập môn',
    minPlayers: 5,
    maxPlayers: 7,
    blurb: 'Ít lá đặc biệt, luật dễ nhớ. Hợp nhóm mới chơi lần đầu.',
    roles: { werewolf: 2, seer: 1, bodyguard: 1, villager: 2 },
  },
  {
    id: 'classic',
    name: 'Cổ điển',
    minPlayers: 8,
    maxPlayers: 10,
    blurb: 'Bộ hay gặp nhất: đủ Tiên tri, Bảo vệ, Phù thủy, Thợ săn.',
    roles: { werewolf: 2, seer: 1, bodyguard: 1, witch: 1, hunter: 1, villager: 3 },
  },
  {
    id: 'balanced',
    name: 'Cân bằng',
    minPlayers: 10,
    maxPlayers: 12,
    blurb: 'Thêm Sói trùm cho phe sói một đòn bất ngờ giữa ván.',
    roles: { werewolf: 2, alpha_wolf: 1, seer: 1, bodyguard: 1, witch: 1, hunter: 1, villager: 4 },
  },
  {
    id: 'full',
    name: 'Đầy đủ',
    minPlayers: 12,
    maxPlayers: 15,
    blurb: 'Sói tiên tri và Già làng vào sân. Đêm dài, suy luận nhiều tầng.',
    roles: {
      werewolf: 2,
      alpha_wolf: 1,
      wolf_seer: 1,
      seer: 1,
      bodyguard: 1,
      witch: 1,
      hunter: 1,
      elder: 1,
      villager: 4,
    },
  },
  {
    id: 'chaos',
    name: 'Hỗn loạn',
    minPlayers: 14,
    maxPlayers: 20,
    blurb: 'Có Cupid. Đôi tình nhân khác phe có thể lật ngược cả ván.',
    roles: {
      werewolf: 3,
      alpha_wolf: 1,
      wolf_seer: 1,
      seer: 1,
      bodyguard: 1,
      witch: 1,
      hunter: 1,
      elder: 1,
      cupid: 1,
      villager: 5,
    },
  },
]

export function countRoles(roles: Partial<Record<RoleId, number>>): number {
  return Object.values(roles).reduce<number>((sum, n) => sum + (n ?? 0), 0)
}

export function wolfCount(roles: Partial<Record<RoleId, number>>): number {
  return Object.entries(roles).reduce<number>(
    (sum, [id, n]) => sum + (ROLES[id as RoleId].team === 'WOLF' ? (n ?? 0) : 0),
    0,
  )
}

export function packsFor(playerCount: number): Pack[] {
  return PACKS.filter((p) => playerCount >= p.minPlayers && playerCount <= p.maxPlayers)
}

export function fitPackTo(pack: Pack, playerCount: number): Partial<Record<RoleId, number>> {
  const roles = { ...pack.roles }
  let diff = playerCount - countRoles(roles)
  roles.villager = Math.max(0, (roles.villager ?? 0) + diff)
  diff = playerCount - countRoles(roles)
  if (diff > 0) roles.werewolf = (roles.werewolf ?? 0) + diff
  return roles
}

export function autoBalance(playerCount: number): Partial<Record<RoleId, number>> {
  const wolves = Math.max(1, Math.round(playerCount / 4.5))
  const roles: Partial<Record<RoleId, number>> = {}
  if (wolves >= 3) {
    roles.alpha_wolf = 1
    roles.werewolf = wolves - 1
  } else {
    roles.werewolf = wolves
  }
  const specials: RoleId[] = ['seer', 'bodyguard', 'witch', 'hunter', 'elder', 'cupid']
  const specialBudget = Math.min(specials.length, Math.max(1, Math.floor((playerCount - wolves) / 2)))
  for (let i = 0; i < specialBudget; i++) roles[specials[i]] = 1
  const rest = playerCount - countRoles(roles)
  if (rest > 0) roles.villager = rest
  return roles
}

export type SetupIssue = { level: 'error' | 'warn'; message: string }

export function validateSetup(
  roles: Partial<Record<RoleId, number>>,
  playerCount: number,
): SetupIssue[] {
  const issues: SetupIssue[] = []
  const total = countRoles(roles)
  const wolves = wolfCount(roles)

  if (total !== playerCount) {
    issues.push({
      level: 'error',
      message: `Tổng số lá là ${total} nhưng có ${playerCount} người chơi. Lệch ${Math.abs(total - playerCount)} lá.`,
    })
  }
  if (wolves === 0) issues.push({ level: 'error', message: 'Chưa có lá Sói nào. Ván sẽ kết thúc ngay.' })
  if (wolves >= playerCount - wolves) {
    issues.push({ level: 'error', message: 'Sói đông hơn hoặc bằng phe còn lại — phe Sói thắng ngay khi bắt đầu.' })
  }
  for (const [id, n] of Object.entries(roles)) {
    const role = ROLES[id as RoleId]
    if (role.max !== null && (n ?? 0) > role.max) {
      issues.push({ level: 'error', message: `${role.name} chỉ được tối đa ${role.max} lá.` })
    }
  }
  if (playerCount >= 8 && wolves < 2) {
    issues.push({ level: 'warn', message: 'Từ 8 người trở lên nên có ít nhất 2 Sói, không thì dân dễ thắng.' })
  }
  if (roles.cupid && playerCount < 8) {
    issues.push({ level: 'warn', message: 'Cupid trong ván ít người dễ làm ván kết thúc sớm.' })
  }
  if ((roles.villager ?? 0) === 0 && playerCount >= 8) {
    issues.push({ level: 'warn', message: 'Không có Dân làng nào — ai cũng có chức, ván sẽ rất khó cho Sói.' })
  }
  return issues
}
