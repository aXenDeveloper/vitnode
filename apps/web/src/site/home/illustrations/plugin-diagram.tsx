import type { LucideIcon } from 'lucide-react'

import {
  Braces,
  Database,
  Languages,
  LayoutDashboard,
  Plug,
  Route,
  ShieldCheck,
} from 'lucide-react'

const CX = 280
const CY = 220

interface Module {
  angle: number
  Icon: LucideIcon
  label: string
}

const MODULES: Module[] = [
  { angle: -150, Icon: Route, label: 'Pages & routes' },
  { angle: -90, Icon: Braces, label: 'Typed API' },
  { angle: -30, Icon: Database, label: 'Data model' },
  { angle: 30, Icon: Languages, label: 'Translations' },
  { angle: 90, Icon: LayoutDashboard, label: 'AdminCP screens' },
  { angle: 150, Icon: ShieldCheck, label: 'Permissions' },
]

const position = (angle: number) => {
  const radians = (angle * Math.PI) / 180

  return { x: CX + 194 * Math.cos(radians), y: CY + 142 * Math.sin(radians) }
}

export const PluginDiagram = () => (
  <svg
    aria-hidden
    className="h-auto w-full"
    fill="none"
    viewBox="0 0 560 420"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      className="stroke-border"
      height={384}
      rx={30}
      strokeDasharray="8 8"
      strokeWidth={1.5}
      width={528}
      x={16}
      y={18}
    />
    <rect className="fill-muted" height={24} rx={8} width={112} x={32} y={30} />
    <text
      className="fill-muted-foreground text-xs font-semibold"
      textAnchor="middle"
      x={88}
      y={46}
    >
      Your host app
    </text>

    {MODULES.map(({ angle, label }) => {
      const point = position(angle)

      return (
        <g key={label}>
          <line
            className="stroke-border"
            strokeWidth={1.5}
            x1={point.x}
            x2={CX}
            y1={point.y}
            y2={CY}
          />
          <line
            className="mk-anim-dash stroke-primary/60"
            strokeWidth={2}
            x1={point.x}
            x2={CX}
            y1={point.y}
            y2={CY}
          />
        </g>
      )
    })}

    <circle
      className="mk-anim-pulse-ring mk-origin-center stroke-primary"
      cx={CX}
      cy={CY}
      r={62}
      strokeWidth={2}
    />
    <circle
      className="mk-anim-pulse-ring mk-origin-center stroke-primary"
      cx={CX}
      cy={CY}
      r={62}
      strokeWidth={2}
      style={{ animationDelay: '-1.5s' }}
    />
    <rect
      className="fill-primary drop-shadow-lg"
      height={112}
      rx={28}
      width={112}
      x={CX - 56}
      y={CY - 56}
    />
    <Plug
      className="text-primary-foreground"
      height={44}
      strokeWidth={1.8}
      width={44}
      x={CX - 22}
      y={CY - 30}
    />
    <text
      className="fill-primary-foreground text-xs font-semibold"
      textAnchor="middle"
      x={CX}
      y={CY + 40}
    >
      your plugin
    </text>

    {MODULES.map(({ angle, Icon, label }, index) => {
      const point = position(angle)

      return (
        <g
          className="mk-anim-float"
          key={label}
          style={{ animationDelay: `-${index * 0.6}s` }}
        >
          <rect
            className="fill-card stroke-border drop-shadow-md"
            height={50}
            rx={14}
            strokeWidth={1.5}
            width={148}
            x={point.x - 74}
            y={point.y - 25}
          />
          <rect
            className="fill-primary/10"
            height={32}
            rx={10}
            width={32}
            x={point.x - 64}
            y={point.y - 16}
          />
          <Icon
            className="text-primary"
            height={18}
            strokeWidth={2}
            width={18}
            x={point.x - 57}
            y={point.y - 9}
          />
          <text
            className="fill-foreground text-xs font-semibold"
            x={point.x - 24}
            y={point.y + 4}
          >
            {label}
          </text>
        </g>
      )
    })}
  </svg>
)
