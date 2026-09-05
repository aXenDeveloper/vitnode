import type { LucideIcon } from 'lucide-react'

import {
  CalendarDays,
  Images,
  LayoutDashboard,
  PenLine,
  ShieldUser,
  ShoppingBag,
  Users,
} from 'lucide-react'

interface PluginTile {
  Icon: LucideIcon
  name: string
  pkg: string
  slot: { x: number; y: number }
}

const SLOT = { height: 124, width: 156 }

const PLUGINS: PluginTile[] = [
  { Icon: PenLine, name: 'Blog', pkg: '@acme/blog', slot: { x: 204, y: 92 } },
  {
    Icon: ShoppingBag,
    name: 'Shop',
    pkg: '@acme/shop',
    slot: { x: 372, y: 92 },
  },
  {
    Icon: CalendarDays,
    name: 'Events',
    pkg: '@acme/events',
    slot: { x: 204, y: 240 },
  },
  {
    Icon: Images,
    name: 'Gallery',
    pkg: '@acme/gallery',
    slot: { x: 372, y: 240 },
  },
]

const CORE_NAV: { Icon: LucideIcon; label: string }[] = [
  { Icon: LayoutDashboard, label: 'Dashboard' },
  { Icon: Users, label: 'Users' },
  { Icon: ShieldUser, label: 'Staff' },
]

const PERIOD = 3

const stagger = (index: number): React.CSSProperties => ({
  animationDelay: `${(index - PLUGINS.length) * PERIOD}s`,
})

export const PluginDiagram = () => (
  <svg
    aria-hidden
    className="h-auto w-full"
    fill="none"
    viewBox="0 0 560 420"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <clipPath id="plugin-window-clip">
        <rect height={338} width={362} x={182} y={62} />
      </clipPath>
    </defs>
    <rect
      className="fill-card stroke-border drop-shadow-lg"
      height={380}
      rx={22}
      strokeWidth={1.5}
      width={528}
      x={16}
      y={20}
    />
    <line
      className="stroke-border"
      strokeWidth={1.5}
      x1={16}
      x2={544}
      y1={60}
      y2={60}
    />
    <circle className="fill-red-400/70" cx={40} cy={40} r={4} />
    <circle className="fill-amber-400/70" cx={54} cy={40} r={4} />
    <circle className="fill-emerald-400/70" cx={68} cy={40} r={4} />
    <rect
      className="fill-muted"
      height={20}
      rx={6}
      width={196}
      x={182}
      y={30}
    />
    <text
      className="fill-muted-foreground font-mono text-xs"
      textAnchor="middle"
      x={280}
      y={44}
    >
      yourcommunity.com/admin
    </text>

    <line
      className="stroke-border"
      strokeWidth={1.5}
      x1={180}
      x2={180}
      y1={60}
      y2={400}
    />
    <text className="fill-muted-foreground text-xs font-semibold" x={32} y={86}>
      CORE
    </text>
    {CORE_NAV.map(({ Icon, label }, index) => (
      <g key={label}>
        <Icon
          className="text-muted-foreground"
          height={14}
          width={14}
          x={32}
          y={100 + index * 28}
        />
        <text className="fill-foreground text-xs" x={54} y={111 + index * 28}>
          {label}
        </text>
      </g>
    ))}

    <text
      className="fill-muted-foreground text-xs font-semibold"
      x={32}
      y={210}
    >
      PLUGINS
    </text>
    {PLUGINS.map(({ Icon, name }, index) => (
      <g className="mk-anim-plug-nav" key={name} style={stagger(index)}>
        <rect
          className="fill-primary/10"
          height={24}
          rx={7}
          width={132}
          x={26}
          y={222 + index * 30}
        />
        <Icon
          className="text-primary"
          height={14}
          width={14}
          x={34}
          y={227 + index * 30}
        />
        <text
          className="fill-foreground text-xs font-medium"
          x={56}
          y={238 + index * 30}
        >
          {name}
        </text>
      </g>
    ))}

    {PLUGINS.map(({ name, slot }) => (
      <rect
        className="stroke-border"
        height={SLOT.height}
        key={name}
        rx={16}
        strokeDasharray="6 6"
        strokeWidth={1.5}
        width={SLOT.width}
        x={slot.x}
        y={slot.y}
      />
    ))}

    <g clipPath="url(#plugin-window-clip)">
      {PLUGINS.map(({ Icon, name, pkg, slot }, index) => (
        <g
          className="mk-anim-plug"
          key={name}
          style={{
            ...stagger(index),
            offsetPath: `path('M 600 ${slot.y} L ${slot.x} ${slot.y}')`,
          }}
        >
          <rect
            className="fill-card stroke-primary drop-shadow-md"
            height={SLOT.height}
            rx={16}
            strokeWidth={1.5}
            width={SLOT.width}
          />
          <rect
            className="fill-primary/10"
            height={40}
            rx={12}
            width={40}
            x={16}
            y={16}
          />
          <Icon
            className="text-primary"
            height={22}
            strokeWidth={1.9}
            width={22}
            x={25}
            y={25}
          />
          <text className="fill-foreground text-sm font-semibold" x={16} y={84}>
            {name}
          </text>
          <text
            className="fill-muted-foreground font-mono text-xs"
            x={16}
            y={104}
          >
            {pkg}
          </text>
          <circle className="fill-emerald-500" cx={136} cy={36} r={5} />
        </g>
      ))}
    </g>

    <text
      className="fill-muted-foreground text-xs"
      textAnchor="middle"
      x={362}
      y={392}
    >
      install a package · it shows up everywhere it should
    </text>
  </svg>
)
