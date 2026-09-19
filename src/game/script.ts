import type { GameState } from './events'
import type { NightActionKind, RoleId } from './roles'
import { ROLES } from './roles'

export type StepAction =
  | NightActionKind
  | 'LYNCH'
  | 'HUNTER_SHOT'
  | 'RESOLVE_NIGHT'
  | 'NEXT_PHASE'
  | 'NONE'

export type Step = {
  id: string
  kind: 'pick' | 'confirm' | 'announce'
  action: StepAction
  speech: string
  hint?: string
  note?: string
  cta?: string
  targetIds?: string[]
  count?: number
  skipLabel?: string
  confirmLabel?: string
  denyLabel?: string
  confirmTargetId?: string | null
}

function nameOf(state: GameState, id: string | null | undefined): string {
  if (!id) return ''
  return state.players.find((p) => p.id === id)?.name ?? ''
}

function inPlay(state: GameState, roleId: RoleId): boolean {
  return state.players.some((p) => p.roleId === roleId)
}

function holderAlive(state: GameState, roleId: RoleId): boolean {
  return state.players.some((p) => p.roleId === roleId && p.alive)
}

function aliveIds(state: GameState): string[] {
  return state.players.filter((p) => p.alive).map((p) => p.id)
}

function sleepwalkStep(roleId: RoleId): Step {
  const role = ROLES[roleId]
  return {
    id: `dead-${roleId}`,
    kind: 'announce',
    action: 'NONE',
    speech: `${role.name} thức dậy.`,
    hint: 'Chờ vài giây rồi bảo nhắm mắt lại.',
    note: `${role.name} đã chết — vẫn phải gọi, không thì cả bàn đoán ra.`,
    cta: 'Đã gọi xong',
  }
}

function nightScript(state: GameState): Step[] {
  const steps: Step[] = []
  const alive = aliveIds(state)

  if (inPlay(state, 'cupid') && state.round === 1) {
    if (holderAlive(state, 'cupid')) {
      steps.push({
        id: 'cupid',
        kind: 'pick',
        action: 'CUPID_LINK',
        speech: 'Cupid thức dậy. Cupid chọn hai người làm đôi tình nhân.',
        hint: 'Chọn đúng 2 người — Cupid được chọn cả chính mình.',
        targetIds: alive,
        count: 2,
      })
    } else {
      steps.push(sleepwalkStep('cupid'))
    }
    steps.push({
      id: 'lovers-meet',
      kind: 'announce',
      action: 'NONE',
      speech: 'Đôi tình nhân mở mắt nhìn nhau, rồi nhắm lại.',
      hint: state.lovers
        ? `Đôi này là ${nameOf(state, state.lovers[0])} và ${nameOf(state, state.lovers[1])}.`
        : 'Chưa ghép đôi — quay lại bước trước nếu bỏ sót.',
      cta: 'Đã cho nhìn nhau',
    })
  }

  if (inPlay(state, 'bodyguard')) {
    if (holderAlive(state, 'bodyguard')) {
      const last = state.guardLastTarget
      steps.push({
        id: 'guard',
        kind: 'pick',
        action: 'GUARD_PROTECT',
        speech: 'Bảo vệ thức dậy. Đêm nay Bảo vệ muốn che cho ai?',
        hint: last
          ? `Đêm trước đã che ${nameOf(state, last)} — đêm nay không được chọn lại người đó.`
          : 'Bảo vệ được tự che cho mình.',
        targetIds: alive.filter((id) => id !== state.guardLastTarget),
        count: 1,
        skipLabel: 'Không che ai',
      })
    } else {
      steps.push(sleepwalkStep('bodyguard'))
    }
  }

  const wolvesInPlay =
    inPlay(state, 'werewolf') || inPlay(state, 'alpha_wolf') || inPlay(state, 'wolf_seer')
  if (wolvesInPlay) {
    steps.push({
      id: 'wolf',
      kind: 'pick',
      action: 'WOLF_KILL',
      speech: 'Sói thức dậy. Đêm nay bầy sói muốn giết ai?',
      hint: 'Cả bầy chỉ tay vào một người — bạn chọn người đó trên màn hình. Sói được phép cắn cả đồng bọn lẫn chính mình.',
      targetIds: alive,
      count: 1,
      skipLabel: 'Sói không cắn ai',
    })
  }

  if (holderAlive(state, 'alpha_wolf') && !state.alphaConvertUsed) {
    const victim = state.pendingNight.WOLF_KILL[0]
    steps.push({
      id: 'alpha',
      kind: 'confirm',
      action: 'ALPHA_CONVERT',
      speech: victim
        ? `Sói trùm có muốn biến ${nameOf(state, victim)} thành sói, thay vì cắn không?`
        : 'Sói trùm có muốn biến ai đó thành sói không?',
      hint: 'Một lần duy nhất cả ván. Dùng thì đêm nay không ai chết vì sói.',
      note: victim ? undefined : 'Chưa chọn mục tiêu cho sói nên chưa biến được ai.',
      confirmTargetId: victim ?? null,
      confirmLabel: 'Có — biến thành sói',
      denyLabel: 'Không',
    })
  }

  if (inPlay(state, 'wolf_seer')) {
    if (holderAlive(state, 'wolf_seer')) {
      steps.push({
        id: 'wolfseer',
        kind: 'pick',
        action: 'WOLF_SEER_INSPECT',
        speech: 'Sói tiên tri thức dậy. Sói tiên tri muốn soi ai?',
        targetIds: alive,
        count: 1,
        skipLabel: 'Không soi ai',
      })
      steps.push({
        id: 'wolfseer-answer',
        kind: 'announce',
        action: 'NONE',
        speech: 'Trả lời Sói tiên tri.',
        cta: 'Đã trả lời',
      })
    } else {
      steps.push(sleepwalkStep('wolf_seer'))
    }
  }

  if (inPlay(state, 'seer')) {
    if (holderAlive(state, 'seer')) {
      steps.push({
        id: 'seer',
        kind: 'pick',
        action: 'SEER_INSPECT',
        speech: 'Tiên tri thức dậy. Tiên tri muốn soi ai?',
        targetIds: alive,
        count: 1,
        skipLabel: 'Không soi ai',
      })
      steps.push({
        id: 'seer-answer',
        kind: 'announce',
        action: 'NONE',
        speech: 'Trả lời Tiên tri bằng ngón tay cái.',
        cta: 'Đã trả lời',
      })
    } else {
      steps.push(sleepwalkStep('seer'))
    }
  }

  if (inPlay(state, 'witch')) {
    if (holderAlive(state, 'witch')) {
      if (!state.witchHealUsed) {
        const converting = !state.alphaConvertUsed && Boolean(state.pendingNight.ALPHA_CONVERT[0])
        const victim = converting ? undefined : state.pendingNight.WOLF_KILL[0]
        steps.push({
          id: 'witch-heal',
          kind: 'confirm',
          action: 'WITCH_HEAL',
          speech: victim
            ? `Phù thủy thức dậy. Đêm nay ${nameOf(state, victim)} bị giết. Phù thủy có muốn cứu không?`
            : 'Phù thủy thức dậy. Đêm nay không ai bị sói cắn.',
          hint: 'Bình cứu chỉ dùng được một lần cả ván.',
          confirmTargetId: victim ?? null,
          confirmLabel: victim ? `Có — cứu ${nameOf(state, victim)}` : 'Có',
          denyLabel: 'Không cứu',
        })
      }
      if (!state.witchPoisonUsed) {
        steps.push({
          id: 'witch-poison',
          kind: 'pick',
          action: 'WITCH_POISON',
          speech: 'Phù thủy có muốn dùng bình độc giết ai không?',
          hint: 'Bình độc cũng chỉ dùng được một lần. Bảo vệ không cản được độc.',
          targetIds: alive,
          count: 1,
          skipLabel: 'Không dùng bình độc',
        })
      }
      if (state.witchHealUsed && state.witchPoisonUsed) {
        steps.push({
          id: 'witch-empty',
          kind: 'announce',
          action: 'NONE',
          speech: 'Phù thủy thức dậy.',
          note: 'Phù thủy đã dùng hết cả hai bình — vẫn gọi để giấu.',
          cta: 'Đã gọi xong',
        })
      }
    } else {
      steps.push(sleepwalkStep('witch'))
    }
  }

  steps.push({
    id: 'night-end',
    kind: 'announce',
    action: 'RESOLVE_NIGHT',
    speech: 'Hết đêm. Trời sáng, cả làng mở mắt.',
    hint: 'Bấm để chốt đêm — app tính ai chết và vì sao.',
    cta: 'Kết thúc đêm',
  })

  return steps
}

function dayScript(state: GameState): Step[] {
  if (state.phase === 'DAY_REVEAL') {
    const deaths = state.deaths.filter((d) => d.round === state.round)
    const names = deaths.map((d) => nameOf(state, d.playerId)).filter(Boolean)
    return [
      {
        id: 'reveal',
        kind: 'announce',
        action: 'NEXT_PHASE',
        speech: names.length
          ? `Đêm qua, ${names.join(' và ')} đã chết.`
          : 'Đêm qua bình yên. Không ai chết.',
        hint: 'Công bố cho cả làng. Không nói nguyên nhân, không nói lá bài.',
        cta: 'Sang thảo luận',
      },
    ]
  }

  if (state.phase === 'DAY_DISCUSS') {
    return [
      {
        id: 'discuss',
        kind: 'announce',
        action: 'NEXT_PHASE',
        speech: 'Cả làng thảo luận.',
        hint: 'Hết giờ sẽ có chuông, nhưng bạn vẫn là người bấm chuyển bước.',
        cta: 'Sang bỏ phiếu',
      },
    ]
  }

  if (state.phase === 'DAY_VOTE') {
    return [
      {
        id: 'vote',
        kind: 'pick',
        action: 'LYNCH',
        speech: 'Bỏ phiếu. Cả làng muốn treo cổ ai?',
        hint: 'Đếm phiếu ngoài đời rồi chọn người bị nhiều phiếu nhất.',
        targetIds: aliveIds(state),
        count: 1,
        skipLabel: 'Không treo ai',
      },
      {
        id: 'vote-end',
        kind: 'announce',
        action: 'NEXT_PHASE',
        speech: 'Trời tối. Cả làng nhắm mắt lại.',
        cta: 'Sang đêm tiếp theo',
      },
    ]
  }

  return []
}

export function buildScript(state: GameState): Step[] {
  if (state.phase === 'NIGHT') return nightScript(state)
  return dayScript(state)
}

export function hunterStep(state: GameState): Step | null {
  if (!state.pendingHunterId) return null
  const name = nameOf(state, state.pendingHunterId)
  return {
    id: 'hunter',
    kind: 'pick',
    action: 'HUNTER_SHOT',
    speech: `${name} là Thợ săn và vừa chết. Thợ săn muốn bắn ai theo mình?`,
    hint: 'Phải xử lý phát bắn này trước khi đi tiếp.',
    targetIds: aliveIds(state),
    count: 1,
  }
}

export function currentStep(state: GameState): Step | null {
  const pending = hunterStep(state)
  if (pending) return pending
  const script = buildScript(state)
  if (script.length === 0) return null
  return script[Math.min(state.stepIndex, script.length - 1)] ?? null
}
