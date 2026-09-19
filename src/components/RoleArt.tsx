import type { RoleId } from '@/game/roles'

const WOLF_HEAD =
  'M32 56 C16 49 12 38 12 27 L12 13 L23 21 C25.5 18.5 28.5 17.5 32 17.5 C35.5 17.5 38.5 18.5 41 21 L52 13 L52 27 C52 38 48 49 32 56 Z'

const WOLF_HEAD_LOW =
  'M32 59 C18 52 14 42 14 32 L14 20 L24 27 C26 25 29 24 32 24 C35 24 38 25 40 27 L50 20 L50 32 C50 42 46 52 32 59 Z'

const EMBLEM: Record<RoleId, React.ReactNode> = {
  werewolf: (
    <>
      <path d={WOLF_HEAD} />
      <circle cx="24" cy="30" r="3" className="cut" />
      <circle cx="40" cy="30" r="3" className="cut" />
      <path d="M27 40 L37 40 L34 47 L30 47 Z" className="cut" />
    </>
  ),
  alpha_wolf: (
    <>
      <path d="M14 18 L14 7 L21.5 13 L27 4 L32 12 L37 4 L42.5 13 L50 7 L50 18 Z" className="accent" />
      <path d={WOLF_HEAD_LOW} />
      <circle cx="24" cy="36" r="2.8" className="cut" />
      <circle cx="40" cy="36" r="2.8" className="cut" />
      <path d="M28 45 L36 45 L33 51 L31 51 Z" className="cut" />
    </>
  ),
  wolf_seer: (
    <>
      <path d={WOLF_HEAD} />
      <path d="M17 33 Q32 21 47 33 Q32 45 17 33 Z" className="cut" />
      <circle cx="32" cy="33" r="5.5" />
      <circle cx="32" cy="33" r="2.2" className="cut" />
    </>
  ),
  villager: (
    <>
      <path d="M32 7 L57 28 L50 28 L50 55 L14 55 L14 28 L7 28 Z" />
      <rect x="26" y="38" width="12" height="17" className="cut" />
      <rect x="20" y="30" width="8" height="6" className="cut" />
    </>
  ),
  seer: (
    <>
      <path d="M6 33 Q19 17 32 17 Q45 17 58 33 Q45 49 32 49 Q19 49 6 33 Z" />
      <circle cx="32" cy="33" r="9.5" className="cut" />
      <circle cx="32" cy="33" r="5" />
      <path d="M32 6 L32 12 M11 13 L15 18 M53 13 L49 18" className="line" />
    </>
  ),
  bodyguard: (
    <>
      <path d="M32 6 L54 14 L54 32 Q54 48 32 58 Q10 48 10 32 L10 14 Z" />
      <path d="M32 16 L45 21 L45 32 Q45 42 32 48 Q19 42 19 32 L19 21 Z" className="cut" />
      <path d="M32 24 L32 40 M25 31 L39 31" className="line" />
    </>
  ),
  witch: (
    <>
      <rect x="25" y="6" width="14" height="4" rx="2" className="accent" />
      <path d="M27 10 L37 10 L37 24 L49 44 Q53 57 40 57 L24 57 Q11 57 15 44 Z" />
      <path d="M18 41 L46 41 Q50 52 40 52 L24 52 Q14 52 18 41 Z" className="cut" />
      <circle cx="26" cy="47" r="2.4" />
      <circle cx="35" cy="48" r="1.8" />
    </>
  ),
  hunter: (
    <>
      <path d="M22 7 Q46 32 22 57" className="line" />
      <path d="M22 7 L22 57" className="line" />
      <path d="M6 32 L50 32" className="line" />
      <path d="M53 32 L41 25.5 L41 38.5 Z" />
      <path d="M6 32 L13 27 M6 32 L13 37" className="line" />
    </>
  ),
  elder: (
    <>
      <circle cx="27" cy="19" r="10" />
      <path d="M17 25 Q17 50 27 57 Q37 50 37 25 Q32.5 30 27 30 Q21.5 30 17 25 Z" className="accent" />
      <path d="M49 14 L49 57" className="line" />
      <circle cx="49" cy="10" r="4.5" />
    </>
  ),
  cupid: (
    <>
      <path d="M32 55 Q10 39 10 25 Q10 13 20 13 Q28 13 32 21 Q36 13 44 13 Q54 13 54 25 Q54 39 32 55 Z" />
      <path d="M7 57 L49 15" className="line" />
      <path d="M38 12 L52 12 L52 26" className="line" />
    </>
  ),
}

export function RoleArt({ roleId, className = '' }: { roleId: RoleId; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <g fill="currentColor" stroke="none">
        <style>{`
          .accent { opacity: .55 }
          .cut { fill: #0a0b10 }
          .line { fill: none; stroke: currentColor; stroke-width: 3.4; stroke-linecap: round; stroke-linejoin: round }
        `}</style>
        {EMBLEM[roleId]}
      </g>
    </svg>
  )
}
