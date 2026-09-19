export type Team = 'VILLAGE' | 'WOLF'

export type RoleId =
  | 'villager'
  | 'werewolf'
  | 'alpha_wolf'
  | 'wolf_seer'
  | 'seer'
  | 'bodyguard'
  | 'witch'
  | 'hunter'
  | 'elder'
  | 'cupid'

export type NightActionKind =
  | 'WOLF_KILL'
  | 'ALPHA_CONVERT'
  | 'WOLF_SEER_INSPECT'
  | 'SEER_INSPECT'
  | 'GUARD_PROTECT'
  | 'WITCH_HEAL'
  | 'WITCH_POISON'
  | 'CUPID_LINK'

export type Role = {
  id: RoleId
  name: string
  team: Team
  max: number | null
  order: number
  summary: string
  detail: string
  nightActions: NightActionKind[]
  firstNightOnly: boolean
  actsEveryNight: boolean
}

export const ROLES: Record<RoleId, Role> = {
  werewolf: {
    id: 'werewolf',
    name: 'Sói',
    team: 'WOLF',
    max: null,
    order: 10,
    summary: 'Mỗi đêm cùng bầy chọn một người để cắn.',
    detail:
      'Bạn thuộc phe Sói. Mỗi đêm, cả bầy sói thức dậy cùng nhau và thống nhất cắn một người. Ban ngày bạn giả làm dân để tránh bị treo cổ. Phe Sói thắng khi số sói còn sống lớn hơn hoặc bằng số người còn lại.',
    nightActions: ['WOLF_KILL'],
    firstNightOnly: false,
    actsEveryNight: true,
  },
  alpha_wolf: {
    id: 'alpha_wolf',
    name: 'Sói trùm',
    team: 'WOLF',
    max: 1,
    order: 11,
    summary: 'Một lần mỗi ván, thay vì cắn thì biến mục tiêu thành Sói.',
    detail:
      'Bạn là thủ lĩnh bầy sói. Một lần duy nhất trong ván, thay vì cắn người, cả bầy có thể biến mục tiêu thành một con Sói thường — người đó đổi phe ngay lập tức và biết mình đã thành sói. Đêm dùng khả năng này thì bầy sói không cắn ai.',
    nightActions: ['WOLF_KILL', 'ALPHA_CONVERT'],
    firstNightOnly: false,
    actsEveryNight: true,
  },
  wolf_seer: {
    id: 'wolf_seer',
    name: 'Sói tiên tri',
    team: 'WOLF',
    max: 1,
    order: 12,
    summary: 'Mỗi đêm soi chính xác lá bài của một người.',
    detail:
      'Bạn là sói nhưng có khả năng tiên tri. Mỗi đêm, sau khi bầy sói cắn xong, bạn được soi một người và biết chính xác lá bài của người đó (không chỉ biết sói hay dân). Bạn vẫn cắn cùng bầy.',
    nightActions: ['WOLF_SEER_INSPECT'],
    firstNightOnly: false,
    actsEveryNight: true,
  },
  villager: {
    id: 'villager',
    name: 'Dân làng',
    team: 'VILLAGE',
    max: null,
    order: 50,
    summary: 'Không có khả năng đặc biệt. Vũ khí của bạn là lý lẽ và lá phiếu.',
    detail:
      'Bạn là dân thường. Ban đêm bạn ngủ. Ban ngày bạn tranh luận, suy luận và bỏ phiếu treo cổ người bạn nghi là sói. Phe Dân thắng khi không còn con sói nào sống.',
    nightActions: [],
    firstNightOnly: false,
    actsEveryNight: false,
  },
  seer: {
    id: 'seer',
    name: 'Tiên tri',
    team: 'VILLAGE',
    max: 1,
    order: 20,
    summary: 'Mỗi đêm soi một người để biết họ có phải Sói không.',
    detail:
      'Mỗi đêm bạn chọn một người còn sống và quản trò cho bạn biết người đó thuộc phe Sói hay không. Bạn là lá mạnh nhất phe Dân — và cũng là mục tiêu số một của bầy sói. Cân nhắc kỹ khi nào nên lộ diện.',
    nightActions: ['SEER_INSPECT'],
    firstNightOnly: false,
    actsEveryNight: true,
  },
  bodyguard: {
    id: 'bodyguard',
    name: 'Bảo vệ',
    team: 'VILLAGE',
    max: 1,
    order: 21,
    summary: 'Mỗi đêm che chắn một người khỏi nanh sói.',
    detail:
      'Mỗi đêm bạn chọn một người để bảo vệ; nếu đêm đó sói cắn đúng người đó thì họ không chết. Bạn được tự bảo vệ mình, nhưng KHÔNG được bảo vệ cùng một người hai đêm liên tiếp. Bảo vệ không cản được thuốc độc của Phù thủy.',
    nightActions: ['GUARD_PROTECT'],
    firstNightOnly: false,
    actsEveryNight: true,
  },
  witch: {
    id: 'witch',
    name: 'Phù thủy',
    team: 'VILLAGE',
    max: 1,
    order: 30,
    summary: 'Có một bình cứu và một bình độc, mỗi bình dùng được đúng một lần.',
    detail:
      'Mỗi đêm quản trò cho bạn biết ai vừa bị sói cắn. Bạn có thể dùng BÌNH CỨU để cứu người đó (một lần duy nhất cả ván), và/hoặc BÌNH ĐỘC để giết bất kỳ ai (cũng một lần duy nhất). Dùng rồi là hết, không hồi lại.',
    nightActions: ['WITCH_HEAL', 'WITCH_POISON'],
    firstNightOnly: false,
    actsEveryNight: true,
  },
  hunter: {
    id: 'hunter',
    name: 'Thợ săn',
    team: 'VILLAGE',
    max: 1,
    order: 40,
    summary: 'Khi chết, bắn chết một người bất kỳ theo mình.',
    detail:
      'Ban đêm bạn ngủ như dân thường. Nhưng khoảnh khắc bạn chết — bị sói cắn, bị đầu độc hay bị treo cổ — bạn được chỉ vào một người còn sống và người đó chết ngay lập tức. Hãy chuẩn bị sẵn mục tiêu.',
    nightActions: [],
    firstNightOnly: false,
    actsEveryNight: false,
  },
  elder: {
    id: 'elder',
    name: 'Già làng',
    team: 'VILLAGE',
    max: 1,
    order: 41,
    summary: 'Chịu được nhát cắn đầu tiên của bầy sói.',
    detail:
      'Bạn dai sức khác thường: lần đầu tiên bị sói cắn bạn không chết, chỉ bị thương (bạn sẽ biết điều đó). Lần thứ hai thì không qua khỏi. Thuốc độc và treo cổ vẫn giết bạn ngay lần đầu.',
    nightActions: [],
    firstNightOnly: false,
    actsEveryNight: false,
  },
  cupid: {
    id: 'cupid',
    name: 'Cupid',
    team: 'VILLAGE',
    max: 1,
    order: 1,
    summary: 'Đêm đầu tiên ghép hai người thành một đôi tình nhân.',
    detail:
      'Ngay đêm đầu tiên bạn chọn hai người bất kỳ (có thể chọn cả chính mình) làm đôi tình nhân. Hai người đó biết nhau. Nếu một người chết, người còn lại chết theo vì đau buồn. Nếu đôi tình nhân khác phe, họ chỉ thắng khi cả làng chỉ còn lại hai người họ.',
    nightActions: ['CUPID_LINK'],
    firstNightOnly: true,
    actsEveryNight: false,
  },
}

export const ROLE_LIST: Role[] = Object.values(ROLES).sort((a, b) => a.order - b.order)

export const WAKE_ORDER: RoleId[] = ['cupid', 'bodyguard', 'werewolf', 'wolf_seer', 'seer', 'witch']

export function isWolf(roleId: RoleId): boolean {
  return ROLES[roleId].team === 'WOLF'
}
