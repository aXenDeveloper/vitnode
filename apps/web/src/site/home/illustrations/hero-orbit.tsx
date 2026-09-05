import type { LucideIcon } from 'lucide-react'

import {
  Bell,
  FileText,
  Globe,
  Plug,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'

const CX = 270
const CY = 240

interface OrbitNode {
  angle: number
  Icon: LucideIcon
}

interface Orbit {
  duration: number
  nodes: OrbitNode[]
  radius: number
  reverse?: boolean
}

const ORBITS: Orbit[] = [
  {
    duration: 32,
    nodes: [
      { angle: 30, Icon: Users },
      { angle: 210, Icon: FileText },
    ],
    radius: 92,
  },
  {
    duration: 52,
    nodes: [
      { angle: 80, Icon: Plug },
      { angle: 200, Icon: Globe },
      { angle: 320, Icon: Bell },
    ],
    radius: 146,
  },
  {
    duration: 76,
    nodes: [
      { angle: 140, Icon: ShieldCheck },
      { angle: 20, Icon: Sparkles },
      { angle: 260, Icon: Search },
    ],
    radius: 196,
    reverse: true,
  },
]

const toPoint = (radius: number, angle: number) => {
  const radians = (angle * Math.PI) / 180

  return {
    x: CX + radius * Math.cos(radians),
    y: CY + radius * Math.sin(radians),
  }
}

const spin = (
  duration: number,
  origin: { x: number; y: number },
  reverse?: boolean,
): React.CSSProperties => ({
  animation: `${reverse ? 'mk-orbit-reverse' : 'mk-orbit'} ${duration}s linear infinite`,
  transformOrigin: `${origin.x}px ${origin.y}px`,
})

const OrbitRing = ({ duration, nodes, radius, reverse }: Orbit) => (
  <g style={spin(duration, { x: CX, y: CY }, reverse)}>
    <circle
      className="stroke-border"
      cx={CX}
      cy={CY}
      fill="none"
      r={radius}
      strokeDasharray={reverse ? '4 10' : undefined}
      strokeWidth={1.5}
    />

    {nodes.map(({ angle, Icon }) => {
      const point = toPoint(radius, angle)

      return (
        <g key={angle}>
          <line
            className="mk-anim-dash stroke-primary/40"
            strokeWidth={1.5}
            x1={point.x}
            x2={CX}
            y1={point.y}
            y2={CY}
          />
          <g style={spin(duration, point, !reverse)}>
            <circle
              className="fill-card stroke-border drop-shadow-sm"
              cx={point.x}
              cy={point.y}
              r={22}
              strokeWidth={1.5}
            />
            <Icon
              className="text-primary"
              height={20}
              strokeWidth={1.9}
              width={20}
              x={point.x - 10}
              y={point.y - 10}
            />
          </g>
        </g>
      )
    })}
  </g>
)

const FloatingCard = ({
  children,
  delay,
  height = 44,
  width,
  x,
  y,
}: {
  children: React.ReactNode
  delay: number
  height?: number
  width: number
  x: number
  y: number
}) => (
  <g className="mk-anim-float" style={{ animationDelay: `-${delay}s` }}>
    <rect
      className="fill-card stroke-border drop-shadow-md"
      height={height}
      rx={14}
      strokeWidth={1.5}
      width={width}
      x={x}
      y={y}
    />
    {children}
  </g>
)

export const HeroOrbit = () => (
  <svg
    aria-hidden
    className="h-auto w-full max-w-xl"
    fill="none"
    viewBox="0 0 540 480"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <radialGradient id="hero-glow">
        <stop
          offset="0%"
          stopOpacity="0.35"
          style={{ stopColor: 'var(--primary)' }}
        />
        <stop
          offset="100%"
          stopOpacity="0"
          style={{ stopColor: 'var(--primary)' }}
        />
      </radialGradient>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="hero-mark"
        x1="187.5"
        x2="187.5"
        y1="0"
        y2="375.75"
      >
        <stop stopColor="#3261BF" />
        <stop offset="1" stopColor="#363795" />
      </linearGradient>
    </defs>

    <circle
      className="mk-anim-breathe mk-origin-center"
      cx={CX}
      cy={CY}
      fill="url(#hero-glow)"
      r={190}
    />

    {ORBITS.map((orbit) => (
      <OrbitRing key={orbit.radius} {...orbit} />
    ))}

    <circle
      className="mk-anim-pulse-ring mk-origin-center stroke-primary"
      cx={CX}
      cy={CY}
      r={48}
      strokeWidth={2}
    />
    <circle
      className="mk-anim-pulse-ring mk-origin-center stroke-primary"
      cx={CX}
      cy={CY}
      r={48}
      strokeWidth={2}
      style={{ animationDelay: '-1.5s' }}
    />

    <circle className="fill-card drop-shadow-lg" cx={CX} cy={CY} r={54} />

    <g transform={`translate(${CX - 38} ${CY - 38}) scale(0.2)`}>
      <path
        d="M169.385 16.196C180.827 9.60134 194.923 9.60134 206.365 16.196L329.51 87.1749C340.952 93.7695 348 105.957 348 119.146V261.104C348 274.293 340.952 286.481 329.51 293.075L206.365 364.054C194.923 370.649 180.827 370.649 169.385 364.054L46.2396 293.075C34.7982 286.481 27.75 274.293 27.75 261.104V119.146C27.75 105.957 34.7982 93.7695 46.2396 87.1749L169.385 16.196Z"
        fill="#FDFEFF"
      />
      <path
        clipRule="evenodd"
        d="M168.101 5.19482C180.105 -1.73161 194.895 -1.73161 206.899 5.19482L336.101 79.745C348.105 86.6714 355.5 99.472 355.5 113.325V262.425C355.5 276.278 348.105 289.079 336.101 296.005L206.899 370.555C194.895 377.482 180.105 377.482 168.101 370.555L38.899 296.005C26.8948 289.079 19.5 276.278 19.5 262.425V113.325C19.5 99.472 26.8948 86.6714 38.899 79.745L168.101 5.19482ZM109.649 106.082L187.5 61.1613L265.351 106.082L187.5 241.071L109.649 106.082ZM77.6969 148.394V251.232L166.585 302.521L77.6969 148.394ZM208.415 302.521L297.303 251.232V148.394L208.415 302.521Z"
        fill="url(#hero-mark)"
        fillRule="evenodd"
      />
    </g>

    <g className="mk-anim-toast">
      <rect
        className="fill-card stroke-border drop-shadow-md"
        height={56}
        rx={14}
        strokeWidth={1.5}
        width={188}
        x={332}
        y={32}
      />
      <circle className="fill-primary/10" cx={358} cy={60} r={16} />
      <Bell
        className="text-primary"
        height={16}
        strokeWidth={2}
        width={16}
        x={350}
        y={52}
      />
      <circle className="fill-red-500" cx={367} cy={50} r={4} />
      <text className="fill-foreground text-xs font-semibold" x={384} y={56}>
        Hello from the admin
      </text>
      <text className="fill-muted-foreground text-xs" x={384} y={74}>
        live · over WebSocket
      </text>
    </g>

    <FloatingCard delay={2.4} width={150} x={28} y={40}>
      <circle className="fill-primary/10" cx={50} cy={62} r={14} />
      <Users
        className="text-primary"
        height={14}
        strokeWidth={2.2}
        width={14}
        x={43}
        y={55}
      />
      <text className="fill-foreground text-xs font-semibold" x={72} y={59}>
        +42 members
      </text>
      <text className="fill-muted-foreground text-xs" x={72} y={74}>
        joined this week
      </text>
    </FloatingCard>

    <FloatingCard delay={0} height={52} width={204} x={28} y={392}>
      <rect
        className="fill-primary/10"
        height={32}
        rx={9}
        width={32}
        x={40}
        y={402}
      />
      <FileText
        className="text-primary"
        height={16}
        strokeWidth={2}
        width={16}
        x={48}
        y={410}
      />
      <text className="fill-foreground text-xs font-semibold" x={82} y={414}>
        New article published
      </text>
      <text className="fill-muted-foreground text-xs" x={82} y={430}>
        Blog · 2 min read
      </text>
    </FloatingCard>

    <FloatingCard delay={1.2} width={124} x={384} y={400}>
      <Globe
        className="text-primary"
        height={16}
        strokeWidth={2}
        width={16}
        x={398}
        y={414}
      />
      <text className="fill-foreground text-xs font-semibold" x={422} y={426}>
        EN · PL · ES
      </text>
    </FloatingCard>
  </svg>
)
