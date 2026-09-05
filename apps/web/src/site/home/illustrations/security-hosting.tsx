import type { LucideIcon } from 'lucide-react'

import { Bot, Fingerprint, Gauge, KeyRound, Lock } from 'lucide-react'

const CX = 130
const CY = 130

interface Guard {
  angle: number
  Icon: LucideIcon
}

const GUARDS: Guard[] = [
  { angle: -90, Icon: KeyRound },
  { angle: -18, Icon: Bot },
  { angle: 54, Icon: Gauge },
  { angle: 126, Icon: Lock },
  { angle: 198, Icon: Fingerprint },
]

const point = (angle: number) => {
  const radians = (angle * Math.PI) / 180

  return { x: CX + 104 * Math.cos(radians), y: CY + 104 * Math.sin(radians) }
}

const spin = (
  origin: { x: number; y: number },
  reverse: boolean,
): React.CSSProperties => ({
  animation: `${reverse ? 'mk-orbit-reverse' : 'mk-orbit'} 44s linear infinite`,
  transformOrigin: `${origin.x}px ${origin.y}px`,
})

export const ShieldVisual = () => (
  <svg
    aria-hidden
    className="h-auto w-full max-w-xs"
    fill="none"
    viewBox="0 0 260 260"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      className="stroke-border"
      cx={CX}
      cy={CY}
      r={104}
      strokeDasharray="4 10"
      strokeWidth={1.5}
    />
    <circle
      className="mk-anim-pulse-ring mk-origin-center stroke-primary"
      cx={CX}
      cy={CY}
      r={64}
      strokeWidth={2}
    />

    <path
      className="fill-primary/10 stroke-primary drop-shadow-md"
      d="M130 44 L198 72 V134 C198 178 166 208 130 224 C94 208 62 178 62 134 V72 Z"
      strokeLinejoin="round"
      strokeWidth={2}
    />
    <path
      className="mk-anim-draw stroke-primary"
      d="M102 134 L124 156 L162 110"
      pathLength={100}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={7}
    />
    <rect
      className="mk-anim-scan fill-primary/50"
      height={3}
      rx={1.5}
      width={124}
      x={68}
      y={132}
    />

    <g style={spin({ x: CX, y: CY }, false)}>
      {GUARDS.map(({ angle, Icon }) => {
        const p = point(angle)

        return (
          <g key={angle} style={spin(p, true)}>
            <circle
              className="fill-card stroke-border drop-shadow-sm"
              cx={p.x}
              cy={p.y}
              r={18}
              strokeWidth={1.5}
            />
            <Icon
              className="text-primary"
              height={16}
              strokeWidth={2}
              width={16}
              x={p.x - 8}
              y={p.y - 8}
            />
          </g>
        )
      })}
    </g>
  </svg>
)

export const CloudVisual = () => (
  <svg
    aria-hidden
    className="h-auto w-full max-w-48"
    fill="none"
    viewBox="0 0 200 120"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g className="mk-anim-float">
      <path
        className="fill-primary/10 stroke-primary"
        d="M58 92 H146 A24 24 0 0 0 150 44 A34 34 0 0 0 86 36 A26 26 0 0 0 58 92 Z"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <path
        className="stroke-primary"
        d="M100 78 V52 M88 62 L100 50 L112 62"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
      />
    </g>
    {[26, 40, 54].map((y, index) => (
      <circle
        className="mk-anim-led fill-primary/60"
        cx={168 + (index % 2) * 8}
        cy={y}
        key={y}
        r={2.5}
        style={{ animationDelay: `-${index * 0.4}s` }}
      />
    ))}
    <path
      className="stroke-border"
      d="M24 104 H176"
      strokeDasharray="4 8"
      strokeLinecap="round"
      strokeWidth={2}
    />
  </svg>
)

export const ServerVisual = () => (
  <svg
    aria-hidden
    className="h-auto w-full max-w-48"
    fill="none"
    viewBox="0 0 200 120"
    xmlns="http://www.w3.org/2000/svg"
  >
    {[18, 50, 82].map((y, row) => (
      <g key={y}>
        <rect
          className="fill-card stroke-border"
          height={26}
          rx={7}
          strokeWidth={1.5}
          width={128}
          x={36}
          y={y}
        />
        <rect
          className="fill-muted"
          height={6}
          rx={3}
          width={54}
          x={48}
          y={y + 10}
        />
        {[0, 1, 2].map((led) => (
          <circle
            className="mk-anim-led fill-emerald-500"
            cx={128 + led * 11}
            cy={y + 13}
            key={led}
            r={3}
            style={{ animationDelay: `-${(row * 3 + led) * 0.25}s` }}
          />
        ))}
      </g>
    ))}
    <path
      className="stroke-border"
      d="M24 112 H176"
      strokeDasharray="4 8"
      strokeLinecap="round"
      strokeWidth={2}
    />
  </svg>
)
