import type { LucideIcon } from 'lucide-react'

import {
  BookOpen,
  Bot,
  Boxes,
  Braces,
  FileText,
  ListChecks,
  MessageSquare,
  Rocket,
} from 'lucide-react'

const ROUTE =
  'M40 280 H148 Q160 280 160 268 V132 Q160 120 172 120 H308 Q320 120 320 132 V228 Q320 240 332 240 H468 Q480 240 480 228 V80'

interface Station {
  Icon: LucideIcon
  label: string
  labelSide: 'bottom' | 'left' | 'right' | 'top'
  x: number
  y: number
}

const STATIONS: Station[] = [
  {
    Icon: MessageSquare,
    label: 'Your prompt',
    labelSide: 'right',
    x: 40,
    y: 280,
  },
  { Icon: FileText, label: 'AGENTS.md', labelSide: 'right', x: 160, y: 215 },
  { Icon: BookOpen, label: 'llms-full.txt', labelSide: 'top', x: 232, y: 120 },
  {
    Icon: Braces,
    label: 'Typed API + OpenAPI',
    labelSide: 'right',
    x: 320,
    y: 195,
  },
  {
    Icon: Boxes,
    label: 'Plugin boundaries',
    labelSide: 'bottom',
    x: 400,
    y: 240,
  },
  {
    Icon: ListChecks,
    label: 'Lint & conventions',
    labelSide: 'left',
    x: 480,
    y: 155,
  },
  { Icon: Rocket, label: 'Shipped feature', labelSide: 'left', x: 480, y: 80 },
]

const LABEL_WIDTH = 150
const LABEL_HEIGHT = 34

export const AgentMap = () => (
  <svg
    aria-hidden
    className="h-auto w-full"
    fill="none"
    viewBox="0 0 560 340"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <pattern
        height={28}
        id="agent-grid"
        patternUnits="userSpaceOnUse"
        width={28}
      >
        <path className="stroke-border/70" d="M28 0H0V28" strokeWidth={1} />
      </pattern>
    </defs>
    <rect
      className="fill-card stroke-border"
      height={320}
      rx={24}
      strokeWidth={1.5}
      width={544}
      x={8}
      y={10}
    />
    <rect
      fill="url(#agent-grid)"
      height={296}
      rx={16}
      width={520}
      x={20}
      y={22}
    />

    <path
      className="stroke-border"
      d={ROUTE}
      strokeLinecap="round"
      strokeWidth={6}
    />
    <path
      className="mk-anim-dash stroke-primary/60"
      d={ROUTE}
      strokeLinecap="round"
      strokeWidth={2}
    />

    {STATIONS.map(({ Icon, label, labelSide, x, y }) => {
      const labelX =
        labelSide === 'right'
          ? x + 18
          : labelSide === 'left'
            ? x - 18 - LABEL_WIDTH
            : x - LABEL_WIDTH / 2
      const labelY =
        labelSide === 'top'
          ? y - 26 - LABEL_HEIGHT
          : labelSide === 'bottom'
            ? y + 26
            : y - LABEL_HEIGHT / 2

      return (
        <g key={label}>
          <circle
            className="fill-card stroke-primary"
            cx={x}
            cy={y}
            r={8}
            strokeWidth={3}
          />
          <rect
            className="fill-card stroke-border drop-shadow-sm"
            height={LABEL_HEIGHT}
            rx={10}
            strokeWidth={1.5}
            width={LABEL_WIDTH}
            x={labelX}
            y={labelY}
          />
          <Icon
            className="text-primary"
            height={16}
            strokeWidth={2}
            width={16}
            x={labelX + 10}
            y={labelY + 9}
          />
          <text
            className="fill-foreground text-xs font-semibold"
            x={labelX + 34}
            y={labelY + 21}
          >
            {label}
          </text>
        </g>
      )
    })}

    <g className="mk-anim-travel" style={{ offsetPath: `path('${ROUTE}')` }}>
      <circle className="fill-primary/25" r={20} />
      <circle className="fill-primary drop-shadow-md" r={13} />
      <Bot
        className="text-primary-foreground"
        height={16}
        strokeWidth={2.2}
        width={16}
        x={-8}
        y={-8}
      />
    </g>
  </svg>
)
