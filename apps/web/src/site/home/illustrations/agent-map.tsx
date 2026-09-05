import type { LucideIcon } from 'lucide-react'

import {
  Bot,
  Check,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
} from 'lucide-react'

interface TreeRow {
  depth: number
  highlight?: 1 | 2 | 3 | 4
  Icon: LucideIcon
  label: string
}

const TREE: TreeRow[] = [
  { depth: 0, Icon: FileText, highlight: 1, label: 'AGENTS.md' },
  { depth: 0, Icon: FileText, label: 'llms-full.txt' },
  { depth: 0, Icon: FolderOpen, label: 'plugins/events' },
  { depth: 1, Icon: FileCode2, highlight: 2, label: 'config.ts' },
  { depth: 1, Icon: FileCode2, highlight: 3, label: 'routes.ts' },
  { depth: 1, Icon: Folder, label: 'api/modules' },
  { depth: 2, Icon: FileCode2, highlight: 3, label: 'events.ts' },
  { depth: 1, Icon: Folder, label: 'pages' },
  { depth: 2, Icon: FileCode2, highlight: 4, label: 'admin-events.tsx' },
  { depth: 1, Icon: FileJson, label: 'locales/en.json' },
]

const STEPS = [
  'Read AGENTS.md conventions',
  'Loaded llms-full.txt: routing, plugins',
  'Scaffolded plugins/events',
  'Added /events route, RSVP API module',
  'Registered AdminCP page + permission',
  'Lint and typecheck clean. Ready to review.',
]

const ROW_HEIGHT = 24
const TREE_TOP = 70

export const AgentMap = () => (
  <svg
    aria-hidden
    className="h-auto w-full"
    fill="none"
    viewBox="0 0 560 340"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      className="fill-card stroke-border"
      height={308}
      rx={18}
      strokeWidth={1.5}
      width={200}
      x={16}
      y={16}
    />
    <text className="fill-muted-foreground text-xs font-semibold" x={32} y={44}>
      YOUR REPOSITORY
    </text>
    <line
      className="stroke-border"
      strokeWidth={1}
      x1={16}
      x2={216}
      y1={56}
      y2={56}
    />

    {TREE.map(({ depth, highlight, Icon, label }, index) => {
      const y = TREE_TOP + index * ROW_HEIGHT

      return (
        <g key={label}>
          {highlight ? (
            <rect
              className={`mk-anim-file-${highlight} fill-primary/12`}
              height={ROW_HEIGHT - 4}
              rx={6}
              width={184}
              x={24}
              y={y - 2}
            />
          ) : null}
          <Icon
            className={highlight ? 'text-primary' : 'text-muted-foreground'}
            height={14}
            strokeWidth={2}
            width={14}
            x={32 + depth * 14}
            y={y + 3}
          />
          <text
            className={`text-xs ${highlight ? 'fill-foreground font-medium' : 'fill-muted-foreground'}`}
            x={52 + depth * 14}
            y={y + 14}
          >
            {label}
          </text>
        </g>
      )
    })}

    <rect
      className="fill-card stroke-border"
      height={308}
      rx={18}
      strokeWidth={1.5}
      width={312}
      x={232}
      y={16}
    />
    <circle className="fill-primary" cx={256} cy={40} r={11} />
    <Bot
      className="text-primary-foreground"
      height={13}
      strokeWidth={2.2}
      width={13}
      x={249.5}
      y={33.5}
    />
    <text className="fill-foreground text-xs font-semibold" x={274} y={44}>
      Coding agent
    </text>
    <circle
      className="mk-anim-twinkle mk-origin-center fill-emerald-500"
      cx={520}
      cy={40}
      r={4}
    />
    <text
      className="fill-muted-foreground text-xs"
      textAnchor="end"
      x={510}
      y={44}
    >
      working
    </text>
    <line
      className="stroke-border"
      strokeWidth={1}
      x1={232}
      x2={544}
      y1={56}
      y2={56}
    />

    <rect
      className="fill-muted"
      height={30}
      rx={10}
      width={264}
      x={264}
      y={68}
    />
    <text className="fill-foreground text-xs" x={276} y={87}>
      “Build an events plugin with RSVPs.”
    </text>

    {STEPS.map((step, index) => {
      const y = 118 + index * 28

      return (
        <g className={`mk-anim-step-${index + 1}`} key={step}>
          <circle className="fill-emerald-500/15" cx={258} cy={y} r={9} />
          <Check
            className="text-emerald-600 dark:text-emerald-400"
            height={11}
            strokeWidth={3}
            width={11}
            x={252.5}
            y={y - 5.5}
          />
          <text className="fill-foreground text-xs" x={276} y={y + 4}>
            {step}
          </text>
        </g>
      )
    })}

    <rect
      className="fill-muted"
      height={6}
      rx={3}
      width={264}
      x={264}
      y={300}
    />
    <rect
      className="mk-anim-progress mk-origin-left fill-primary"
      height={6}
      rx={3}
      width={264}
      x={264}
      y={300}
    />
  </svg>
)
