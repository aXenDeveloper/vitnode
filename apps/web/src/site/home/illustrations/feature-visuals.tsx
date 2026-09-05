import type { LucideIcon } from 'lucide-react'

import { cn } from '@vitnode/core/lib/utils'
import {
  Bell,
  Boxes,
  Braces,
  Check,
  Database,
  FileCheck,
  FileText,
  Languages,
  LayoutDashboard,
  Mail,
  Monitor,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  Zap,
} from 'lucide-react'

const Visual = ({
  children,
  className,
  viewBox = '0 0 320 180',
}: {
  children: React.ReactNode
  className?: string
  viewBox?: string
}) => (
  <svg
    aria-hidden
    className={cn('h-auto w-full', className)}
    fill="none"
    viewBox={viewBox}
    xmlns="http://www.w3.org/2000/svg"
  >
    {children}
  </svg>
)

const delay = (seconds: number): React.CSSProperties => ({
  animationDelay: `-${seconds}s`,
})

const stagger = (
  index: number,
  count: number,
  period: number,
): React.CSSProperties => ({
  animationDelay: `${(index - count) * period}s`,
})

const CODE_LINES = [
  { text: 'defineContentType({', tone: 'plain' },
  { text: '  id: "blog.article",', tone: 'plain' },
  { text: '  fields: {', tone: 'plain' },
  { text: '    title: field.text({ required: true }),', tone: 'accent' },
  { text: '    body: field.richText(),', tone: 'accent' },
  { text: '    cover: field.image(),', tone: 'accent' },
  { text: '  },', tone: 'plain' },
  { text: '})', tone: 'plain' },
] as const

const CONTENT_OUTPUTS: { Icon: LucideIcon; label: string; meta: string }[] = [
  { Icon: Database, label: 'PostgreSQL table', meta: 'blog_articles' },
  { Icon: FileCheck, label: 'Zod validation', meta: 'z.object({ … })' },
  { Icon: Braces, label: 'Typed CRUD API', meta: 'GET /api/articles' },
  {
    Icon: ShieldCheck,
    label: 'Staff permissions',
    meta: 'can_view · can_edit',
  },
  {
    Icon: LayoutDashboard,
    label: 'AdminCP screens',
    meta: 'list · create · edit',
  },
  { Icon: Languages, label: 'Translations', meta: 'en · pl · es · ja' },
]

const OUTPUT_ROW_Y = [330, 420, 510]
const OUTPUT_LEFT_X = 24
const OUTPUT_RIGHT_X = 312
const OUTPUT_WIDTH = 224
const OUTPUT_HEIGHT = 60
const TRUNK_X = 280

export const ContentEngineVisual = () => (
  <Visual viewBox="0 0 560 600">
    <rect
      className="fill-card stroke-border"
      height={170}
      rx={16}
      strokeWidth={1.5}
      width={480}
      x={40}
      y={24}
    />
    <circle className="fill-red-400/70" cx={60} cy={44} r={4} />
    <circle className="fill-amber-400/70" cx={74} cy={44} r={4} />
    <circle className="fill-emerald-400/70" cx={88} cy={44} r={4} />
    <text className="fill-muted-foreground font-mono text-xs" x={104} y={48}>
      plugins/blog/src/content/article.ts
    </text>
    {CODE_LINES.map(({ text, tone }, index) => (
      <text
        className={cn(
          'font-mono text-xs',
          tone === 'accent' ? 'fill-primary' : 'fill-foreground/80',
        )}
        key={text}
        x={56}
        xmlSpace="preserve"
        y={72 + index * 16}
      >
        {text}
      </text>
    ))}

    <line
      className="stroke-border"
      strokeWidth={2}
      x1={TRUNK_X}
      x2={TRUNK_X}
      y1={194}
      y2={232}
    />
    <circle
      className="mk-anim-travel fill-primary"
      r={5}
      style={{
        animationDuration: '1.6s',
        offsetPath: `path('M${TRUNK_X} 194 L${TRUNK_X} 232')`,
      }}
    />

    <rect
      className="mk-anim-breathe mk-origin-center fill-primary/20"
      height={64}
      rx={32}
      width={212}
      x={174}
      y={220}
    />
    <rect
      className="fill-primary drop-shadow-md"
      height={44}
      rx={22}
      width={188}
      x={186}
      y={230}
    />
    <Boxes
      className="text-primary-foreground"
      height={18}
      strokeWidth={2}
      width={18}
      x={206}
      y={243}
    />
    <text
      className="fill-primary-foreground text-sm font-semibold"
      x={232}
      y={257}
    >
      Content Engine
    </text>

    <line
      className="stroke-border"
      strokeWidth={2}
      x1={TRUNK_X}
      x2={TRUNK_X}
      y1={274}
      y2={OUTPUT_ROW_Y[2] ?? 510}
    />
    <line
      className="mk-anim-dash stroke-primary/60"
      strokeWidth={2}
      x1={TRUNK_X}
      x2={TRUNK_X}
      y1={274}
      y2={OUTPUT_ROW_Y[2] ?? 510}
    />

    {CONTENT_OUTPUTS.map(({ Icon, label, meta }, index) => {
      const left = index % 2 === 0
      const x = left ? OUTPUT_LEFT_X : OUTPUT_RIGHT_X
      const y = OUTPUT_ROW_Y[Math.floor(index / 2)] ?? 330
      const branchEnd = left ? x + OUTPUT_WIDTH : x

      return (
        <g key={label}>
          <line
            className="stroke-border"
            strokeWidth={2}
            x1={TRUNK_X}
            x2={branchEnd}
            y1={y}
            y2={y}
          />
          <line
            className="mk-anim-cycle-6 stroke-primary"
            strokeWidth={2.5}
            style={stagger(index, CONTENT_OUTPUTS.length, 2)}
            x1={TRUNK_X}
            x2={branchEnd}
            y1={y}
            y2={y}
          />
          <rect
            className="fill-card stroke-border"
            height={OUTPUT_HEIGHT}
            rx={14}
            strokeWidth={1.5}
            width={OUTPUT_WIDTH}
            x={x}
            y={y - OUTPUT_HEIGHT / 2}
          />
          <rect
            className="mk-anim-cycle-6 fill-primary/10 stroke-primary"
            height={OUTPUT_HEIGHT}
            rx={14}
            strokeWidth={1.5}
            style={stagger(index, CONTENT_OUTPUTS.length, 2)}
            width={OUTPUT_WIDTH}
            x={x}
            y={y - OUTPUT_HEIGHT / 2}
          />
          <rect
            className="fill-primary/10"
            height={32}
            rx={10}
            width={32}
            x={x + 14}
            y={y - 16}
          />
          <Icon
            className="text-primary"
            height={16}
            strokeWidth={2}
            width={16}
            x={x + 22}
            y={y - 8}
          />
          <text
            className="fill-foreground text-xs font-semibold"
            x={x + 56}
            y={y - 4}
          >
            {label}
          </text>
          <text
            className="fill-muted-foreground font-mono text-xs"
            x={x + 56}
            y={y + 14}
          >
            {meta}
          </text>
          <Check
            className="mk-anim-cycle-6 text-emerald-500"
            height={16}
            strokeWidth={2.5}
            style={stagger(index, CONTENT_OUTPUTS.length, 2)}
            width={16}
            x={x + OUTPUT_WIDTH - 26}
            y={y - 24}
          />
        </g>
      )
    })}

    <text
      className="fill-muted-foreground text-xs"
      textAnchor="middle"
      x={TRUNK_X}
      y={578}
    >
      one definition in · a whole product out
    </text>
  </Visual>
)

const GREETINGS = ['Hello!', 'Cześć!', '¡Hola!', 'こんにちは!']

export const I18nVisual = () => (
  <Visual>
    <circle
      className="fill-primary/5 stroke-border"
      cx={104}
      cy={92}
      r={56}
      strokeWidth={1.5}
    />
    <g
      style={{
        animation: 'mk-orbit 40s linear infinite',
        transformOrigin: '104px 92px',
      }}
    >
      <ellipse
        className="stroke-primary/50"
        cx={104}
        cy={92}
        rx={22}
        ry={56}
        strokeWidth={1.5}
      />
      <ellipse
        className="stroke-primary/50"
        cx={104}
        cy={92}
        rx={44}
        ry={56}
        strokeWidth={1.5}
      />
    </g>
    <path
      className="stroke-border"
      d="M48 92 H160 M58 66 H150 M58 118 H150"
      strokeWidth={1.5}
    />
    <g
      style={{
        animation: 'mk-orbit 9s linear infinite',
        transformOrigin: '104px 92px',
      }}
    >
      <circle className="fill-primary" cx={104} cy={22} r={5} />
    </g>

    <rect
      className="fill-card stroke-border"
      height={46}
      rx={14}
      strokeWidth={1.5}
      width={120}
      x={182}
      y={54}
    />
    <path className="fill-card" d="M186 82 L172 92 L186 96 Z" />
    {GREETINGS.map((greeting, index) => (
      <text
        className="mk-anim-rise-4 fill-foreground text-sm font-semibold"
        key={greeting}
        style={stagger(index, GREETINGS.length, 2)}
        textAnchor="middle"
        x={242}
        y={82}
      >
        {greeting}
      </text>
    ))}

    {['EN', 'PL', 'ES', 'JA'].map((code, index) => (
      <g key={code}>
        <rect
          className="fill-muted"
          height={22}
          rx={7}
          width={30}
          x={182 + index * 32}
          y={116}
        />
        <rect
          className="mk-anim-cycle-4 fill-primary"
          height={22}
          rx={7}
          style={stagger(index, 4, 2)}
          width={30}
          x={182 + index * 32}
          y={116}
        />
        <text
          className="fill-muted-foreground text-xs font-semibold"
          textAnchor="middle"
          x={197 + index * 32}
          y={131}
        >
          {code}
        </text>
        <text
          className="mk-anim-cycle-4 fill-primary-foreground text-xs font-semibold"
          style={stagger(index, 4, 2)}
          textAnchor="middle"
          x={197 + index * 32}
          y={131}
        >
          {code}
        </text>
      </g>
    ))}
  </Visual>
)

const CACHE_HIT_PATH = 'M62 104 C 96 104, 108 62, 142 62'
const CACHE_MISS_PATH =
  'M62 104 C 96 104, 108 62, 142 62 L 178 62 C 212 62, 222 104, 256 104'

export const CacheVisual = () => (
  <Visual>
    <path className="stroke-border" d={CACHE_MISS_PATH} strokeWidth={1.5} />

    <rect
      className="fill-card stroke-border"
      height={44}
      rx={12}
      strokeWidth={1.5}
      width={44}
      x={20}
      y={82}
    />
    <Monitor className="text-foreground" height={20} width={20} x={32} y={94} />

    <rect
      className="fill-primary/10 stroke-primary"
      height={48}
      rx={14}
      strokeWidth={1.5}
      width={48}
      x={136}
      y={38}
    />
    <g className="mk-anim-twinkle mk-origin-center">
      <Zap
        className="fill-primary text-primary"
        height={22}
        width={22}
        x={149}
        y={51}
      />
    </g>

    <rect
      className="fill-card stroke-border"
      height={44}
      rx={12}
      strokeWidth={1.5}
      width={44}
      x={256}
      y={82}
    />
    <Database
      className="text-muted-foreground"
      height={20}
      width={20}
      x={268}
      y={94}
    />

    <circle
      className="mk-anim-travel fill-primary"
      r={5}
      style={{
        animationDuration: '1.8s',
        offsetPath: `path('${CACHE_HIT_PATH}')`,
      }}
    />
    <circle
      className="mk-anim-travel fill-muted-foreground/60"
      r={4}
      style={{
        animationDelay: '0.9s',
        animationDuration: '5.4s',
        offsetPath: `path('${CACHE_MISS_PATH}')`,
      }}
    />

    <g className="mk-anim-appear" style={delay(0.6)}>
      <rect
        className="fill-emerald-500/15"
        height={22}
        rx={7}
        width={82}
        x={119}
        y={98}
      />
      <text
        className="fill-emerald-600 text-xs font-semibold dark:fill-emerald-400"
        textAnchor="middle"
        x={160}
        y={113}
      >
        HIT · 2 ms
      </text>
    </g>

    <text
      className="fill-muted-foreground text-xs"
      textAnchor="middle"
      x={42}
      y={148}
    >
      Visitor
    </text>
    <text
      className="fill-muted-foreground text-xs"
      textAnchor="middle"
      x={160}
      y={148}
    >
      Cache
    </text>
    <text
      className="fill-muted-foreground text-xs"
      textAnchor="middle"
      x={278}
      y={148}
    >
      Database
    </text>
  </Visual>
)

const EVENT_LOG = [
  { name: 'user.created', tone: 'fill-emerald-500' },
  { name: 'blog.post.created', tone: 'fill-primary' },
  { name: 'role.updated', tone: 'fill-amber-500' },
  { name: 'file.uploaded', tone: 'fill-primary' },
]

const LISTENERS: { Icon: LucideIcon; label: string; y: number }[] = [
  { Icon: Mail, label: 'Send email', y: 46 },
  { Icon: Search, label: 'Reindex', y: 90 },
  { Icon: Bell, label: 'Broadcast', y: 134 },
]

const LOG_ROW = 26
const LOG = { height: 140, width: 166, x: 16, y: 20 }
const CHIP = { height: 30, width: 106, x: 202 }

export const EventsVisual = () => (
  <Visual>
    <defs>
      <clipPath id="events-log-clip">
        <rect height={LOG_ROW * 4} width={LOG.width} x={LOG.x} y={LOG.y + 32} />
      </clipPath>
    </defs>

    <rect
      className="fill-card stroke-border"
      height={LOG.height}
      rx={14}
      strokeWidth={1.5}
      width={LOG.width}
      x={LOG.x}
      y={LOG.y}
    />
    <circle
      className="mk-anim-twinkle mk-origin-center fill-emerald-500"
      cx={32}
      cy={38}
      r={4}
    />
    <text className="fill-muted-foreground font-mono text-xs" x={42} y={42}>
      event bus · live
    </text>
    <line
      className="stroke-border"
      strokeWidth={1}
      x1={LOG.x}
      x2={LOG.x + LOG.width}
      y1={52}
      y2={52}
    />

    <g clipPath="url(#events-log-clip)">
      <g className="mk-anim-scroll-log">
        {[...EVENT_LOG, ...EVENT_LOG].map(({ name, tone }, index) => (
          <g key={`${name}-${index < EVENT_LOG.length ? 'a' : 'b'}`}>
            <circle
              className={tone}
              cx={32}
              cy={52 + index * LOG_ROW + 13}
              r={3}
            />
            <text
              className="fill-foreground font-mono text-xs"
              x={42}
              y={52 + index * LOG_ROW + 17}
            >
              {name}
            </text>
          </g>
        ))}
      </g>
    </g>

    {LISTENERS.map(({ Icon, label, y }, index) => {
      const path = `M${LOG.x + LOG.width} 90 C ${LOG.x + LOG.width + 12} 90, ${CHIP.x - 12} ${y}, ${CHIP.x} ${y}`

      return (
        <g key={label}>
          <path className="stroke-border" d={path} strokeWidth={1.5} />
          <circle
            className="mk-anim-travel fill-primary"
            r={3.5}
            style={{
              animationDelay: `-${index * 0.8}s`,
              animationDuration: '2.4s',
              offsetPath: `path('${path}')`,
            }}
          />
          <rect
            className="fill-card stroke-border"
            height={CHIP.height}
            rx={10}
            strokeWidth={1.5}
            width={CHIP.width}
            x={CHIP.x}
            y={y - CHIP.height / 2}
          />
          <rect
            className="mk-anim-cycle-3 fill-primary/10 stroke-primary"
            height={CHIP.height}
            rx={10}
            strokeWidth={1.5}
            style={stagger(index, LISTENERS.length, 2)}
            width={CHIP.width}
            x={CHIP.x}
            y={y - CHIP.height / 2}
          />
          <Icon
            className="text-primary"
            height={14}
            strokeWidth={2}
            width={14}
            x={CHIP.x + 10}
            y={y - 7}
          />
          <text
            className="fill-foreground text-xs font-semibold"
            x={CHIP.x + 30}
            y={y + 4}
          >
            {label}
          </text>
        </g>
      )
    })}
  </Visual>
)

export const AiVisual = () => (
  <Visual>
    <rect
      className="fill-card stroke-border"
      height={144}
      rx={16}
      strokeWidth={1.5}
      width={288}
      x={16}
      y={18}
    />
    <rect className="fill-muted" height={28} rx={9} width={200} x={32} y={34} />
    <text className="fill-foreground text-xs" x={44} y={52}>
      Summarize this thread for me
    </text>

    <circle className="fill-primary/10" cx={44} cy={90} r={12} />
    <Sparkles className="text-primary" height={14} width={14} x={37} y={83} />

    {[
      { width: 220, y: 84 },
      { width: 180, y: 100 },
      { width: 132, y: 116 },
    ].map(({ width, y }, index) => (
      <rect
        className="mk-anim-grow mk-origin-left fill-primary/40"
        height={8}
        key={y}
        rx={4}
        style={delay(index * 0.35)}
        width={width}
        x={66}
        y={y}
      />
    ))}
    <rect
      className="mk-anim-blink fill-primary"
      height={12}
      rx={1}
      width={2}
      x={200}
      y={114}
    />

    {[
      { size: 16, x: 262, y: 32 },
      { size: 10, x: 282, y: 50 },
      { size: 8, x: 250, y: 56 },
    ].map(({ size, x, y }, index) => (
      <g
        className="mk-anim-twinkle mk-origin-center"
        key={x}
        style={delay(index * 0.7)}
      >
        <Sparkles
          className="fill-primary/40 text-primary"
          height={size}
          width={size}
          x={x}
          y={y}
        />
      </g>
    ))}

    <text className="fill-muted-foreground text-xs" x={32} y={150}>
      Your provider · your model · your rules
    </text>
  </Visual>
)

const SEARCH_RESULTS = [
  { meta: 'Guide · 4 min', title: 'Welcome aboard: your first week' },
  { meta: 'Rules · 2 min', title: 'Community guidelines' },
  { meta: 'Guide · 6 min', title: 'How to ask a great question' },
]

export const SearchVisual = () => (
  <Visual viewBox="0 0 560 210">
    <defs>
      <clipPath id="search-typing">
        <rect
          className="mk-anim-grow mk-origin-left"
          height={24}
          width={260}
          x={58}
          y={30}
        />
      </clipPath>
    </defs>

    <rect
      className="fill-card stroke-border"
      height={40}
      rx={12}
      strokeWidth={1.5}
      width={528}
      x={16}
      y={22}
    />
    <Search className="text-primary" height={16} width={16} x={30} y={34} />
    <text
      className="fill-foreground text-xs"
      clipPath="url(#search-typing)"
      x={58}
      y={47}
    >
      onboarding guide for new members
    </text>
    <rect className="fill-muted" height={20} rx={6} width={38} x={494} y={32} />
    <text
      className="fill-muted-foreground text-xs"
      textAnchor="middle"
      x={513}
      y={46}
    >
      ⌘K
    </text>

    {SEARCH_RESULTS.map(({ meta, title }, index) => (
      <g
        className="mk-anim-appear"
        key={title}
        style={delay(0.5 + index * 0.45)}
      >
        <rect
          className="fill-card stroke-border"
          height={32}
          rx={9}
          strokeWidth={1.5}
          width={384}
          x={16}
          y={76 + index * 40}
        />
        <FileText
          className="text-muted-foreground"
          height={14}
          width={14}
          x={28}
          y={85 + index * 40}
        />
        <text
          className="fill-foreground text-xs font-medium"
          x={50}
          y={96 + index * 40}
        >
          {title}
        </text>
        <text
          className="fill-muted-foreground text-xs"
          textAnchor="end"
          x={388}
          y={96 + index * 40}
        >
          {meta}
        </text>
      </g>
    ))}

    <rect
      className="fill-card stroke-border"
      height={112}
      rx={12}
      strokeWidth={1.5}
      width={128}
      x={416}
      y={76}
    />
    <text className="fill-muted-foreground text-xs" x={430} y={98}>
      Ranking engine
    </text>
    {['Postgres', 'Elasticsearch'].map((engine, index) => (
      <g key={engine}>
        <rect
          className="fill-muted"
          height={26}
          rx={8}
          width={100}
          x={430}
          y={110 + index * 34}
        />
        <rect
          className="fill-primary/15 stroke-primary"
          height={26}
          rx={8}
          strokeWidth={1.5}
          style={{
            animation: 'mk-cycle-2 8s ease-in-out infinite',
            animationDelay: `${(index - 2) * 4}s`,
          }}
          width={100}
          x={430}
          y={110 + index * 34}
        />
        <text
          className="fill-foreground text-xs font-semibold"
          x={442}
          y={127 + index * 34}
        >
          {engine}
        </text>
      </g>
    ))}
  </Visual>
)

const DEVICES: { Icon: LucideIcon; name: string }[] = [
  { Icon: Monitor, name: 'desktop' },
  { Icon: Smartphone, name: 'phone' },
  { Icon: Tablet, name: 'tablet' },
]

export const RealtimeVisual = () => (
  <Visual viewBox="0 0 560 210">
    <g className="mk-anim-ring mk-origin-top">
      <Bell
        className="fill-primary/10 text-foreground"
        height={84}
        strokeWidth={1.5}
        width={84}
        x={46}
        y={52}
      />
    </g>
    <g className="mk-anim-badge mk-origin-center">
      <circle className="fill-red-500 drop-shadow-md" cx={114} cy={66} r={7} />
    </g>

    {[0, 1, 2].map((index) => (
      <path
        className="mk-anim-twinkle mk-origin-center stroke-primary"
        d={`M${150 + index * 14} ${72 - index * 12} a ${36 + index * 14} ${36 + index * 14} 0 0 1 0 ${64 + index * 24}`}
        key={index}
        strokeLinecap="round"
        strokeWidth={2}
        style={delay(index * 0.4)}
      />
    ))}

    <g className="mk-anim-toast">
      <rect
        className="fill-card stroke-border drop-shadow-md"
        height={64}
        rx={14}
        strokeWidth={1.5}
        width={290}
        x={244}
        y={36}
      />
      <circle className="fill-emerald-500/15" cx={268} cy={68} r={13} />
      <Check
        className="text-emerald-600 dark:text-emerald-400"
        height={14}
        strokeWidth={2.5}
        width={14}
        x={261}
        y={61}
      />
      <text className="fill-foreground text-xs font-semibold" x={290} y={64}>
        Hello from the admin
      </text>
      <text className="fill-muted-foreground text-xs" x={290} y={82}>
        from the dashboard widget
      </text>
    </g>

    <g className="mk-anim-toast" style={delay(3)}>
      <rect
        className="fill-card stroke-border drop-shadow-md"
        height={64}
        rx={14}
        strokeWidth={1.5}
        width={290}
        x={244}
        y={112}
      />
      <circle className="fill-primary/10" cx={268} cy={144} r={13} />
      <Bell
        className="text-primary"
        height={14}
        strokeWidth={2.2}
        width={14}
        x={261}
        y={137}
      />
      <text className="fill-foreground text-xs font-semibold" x={290} y={140}>
        Maintenance at 22:00
      </text>
      <text className="fill-muted-foreground text-xs" x={290} y={158}>
        broadcast to everyone online
      </text>
    </g>

    {DEVICES.map(({ Icon, name }, index) => (
      <g key={name}>
        <rect
          className="fill-card stroke-border"
          height={30}
          rx={9}
          strokeWidth={1.5}
          width={44}
          x={22 + index * 50}
          y={158}
        />
        <Icon
          className="text-foreground"
          height={14}
          strokeWidth={2}
          width={14}
          x={30 + index * 50}
          y={166}
        />
        <circle
          className="mk-anim-led fill-emerald-500"
          cx={54 + index * 50}
          cy={173}
          r={3}
          style={{ animationDelay: `-${index * 0.5}s` }}
        />
      </g>
    ))}
  </Visual>
)
