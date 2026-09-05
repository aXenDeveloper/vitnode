import type { LucideIcon } from 'lucide-react'

import { cn } from '@vitnode/core/lib/utils'
import {
  Bell,
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
  Sparkles,
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
  { text: '    title: field.text(),', tone: 'accent' },
  { text: '    body: field.richText(),', tone: 'accent' },
  { text: '    cover: field.image(),', tone: 'accent' },
  { text: '  },', tone: 'plain' },
  { text: '})', tone: 'plain' },
] as const

const CONTENT_OUTPUTS: { Icon: LucideIcon; label: string }[] = [
  { Icon: Database, label: 'PostgreSQL table' },
  { Icon: Braces, label: 'Typed CRUD API' },
  { Icon: ShieldCheck, label: 'Staff permissions' },
  { Icon: LayoutDashboard, label: 'AdminCP screens' },
  { Icon: Search, label: 'Search index' },
  { Icon: Languages, label: 'Translations' },
  { Icon: FileCheck, label: 'Zod validation' },
]

export const ContentEngineVisual = () => (
  <Visual viewBox="0 0 560 352">
    <rect
      className="fill-card stroke-border"
      height={196}
      rx={16}
      strokeWidth={1.5}
      width={216}
      x={16}
      y={78}
    />
    <circle className="fill-red-400/70" cx={36} cy={98} r={4} />
    <circle className="fill-amber-400/70" cx={50} cy={98} r={4} />
    <circle className="fill-emerald-400/70" cx={64} cy={98} r={4} />
    <text className="fill-muted-foreground font-mono text-xs" x={80} y={102}>
      article.ts
    </text>

    {CODE_LINES.map(({ text, tone }, index) => (
      <text
        className={cn(
          'font-mono text-xs',
          tone === 'accent' ? 'fill-primary' : 'fill-foreground/80',
        )}
        key={text}
        x={30}
        xmlSpace="preserve"
        y={132 + index * 17}
      >
        {text}
      </text>
    ))}

    {CONTENT_OUTPUTS.map(({ Icon, label }, index) => {
      const y = 44 + index * 44
      const path = `M232 176 C 290 176, 290 ${y}, 344 ${y}`

      return (
        <g key={label}>
          <path className="stroke-border" d={path} strokeWidth={1.5} />
          <path
            className="mk-anim-dash mk-anim-cycle-7 stroke-primary"
            d={path}
            strokeWidth={2}
            style={stagger(index, CONTENT_OUTPUTS.length, 2)}
          />
          <rect
            className="fill-card stroke-border"
            height={36}
            rx={10}
            strokeWidth={1.5}
            width={200}
            x={344}
            y={y - 18}
          />
          <rect
            className="mk-anim-cycle-7 fill-primary/10 stroke-primary"
            height={36}
            rx={10}
            strokeWidth={1.5}
            style={stagger(index, CONTENT_OUTPUTS.length, 2)}
            width={200}
            x={344}
            y={y - 18}
          />
          <Icon
            className="text-primary"
            height={16}
            strokeWidth={2}
            width={16}
            x={358}
            y={y - 8}
          />
          <text
            className="fill-foreground text-xs font-semibold"
            x={384}
            y={y + 4}
          >
            {label}
          </text>
          <Check
            className="mk-anim-cycle-7 text-emerald-500"
            height={16}
            strokeWidth={2.5}
            style={stagger(index, CONTENT_OUTPUTS.length, 2)}
            width={16}
            x={518}
            y={y - 8}
          />
        </g>
      )
    })}

    <text
      className="fill-muted-foreground text-xs"
      textAnchor="middle"
      x={124}
      y={300}
    >
      One definition in
    </text>
    <text
      className="fill-muted-foreground text-xs"
      textAnchor="middle"
      x={444}
      y={340}
    >
      A whole product out
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
          className="fill-foreground text-xs font-semibold mix-blend-difference"
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

const LISTENERS: { Icon: LucideIcon; label: string }[] = [
  { Icon: Mail, label: 'Send email' },
  { Icon: Search, label: 'Update search' },
  { Icon: Bell, label: 'Notify members' },
]

export const EventsVisual = () => (
  <Visual>
    {[0, 1, 2].map((index) => (
      <circle
        className="mk-anim-ripple mk-origin-center stroke-primary"
        cx={72}
        cy={90}
        key={index}
        r={22}
        strokeWidth={1.5}
        style={delay(index)}
      />
    ))}

    {LISTENERS.map(({ Icon, label }, index) => {
      const y = 44 + index * 46
      const path = `M128 90 C 150 90, 150 ${y}, 174 ${y}`

      return (
        <g key={label}>
          <path className="stroke-border" d={path} strokeWidth={1.5} />
          <path
            className="mk-anim-dash mk-anim-cycle-3 stroke-primary"
            d={path}
            strokeWidth={2}
            style={stagger(index, LISTENERS.length, 2)}
          />
          <rect
            className="fill-card stroke-border"
            height={32}
            rx={10}
            strokeWidth={1.5}
            width={130}
            x={174}
            y={y - 16}
          />
          <rect
            className="mk-anim-cycle-3 fill-primary/10 stroke-primary"
            height={32}
            rx={10}
            strokeWidth={1.5}
            style={stagger(index, LISTENERS.length, 2)}
            width={130}
            x={174}
            y={y - 16}
          />
          <Icon
            className="text-primary"
            height={14}
            strokeWidth={2}
            width={14}
            x={186}
            y={y - 7}
          />
          <text
            className="fill-foreground text-xs font-semibold"
            x={208}
            y={y + 4}
          >
            {label}
          </text>
        </g>
      )
    })}

    <rect
      className="fill-primary drop-shadow-md"
      height={36}
      rx={10}
      width={112}
      x={16}
      y={72}
    />
    <text
      className="fill-primary-foreground font-mono text-xs font-semibold"
      textAnchor="middle"
      x={72}
      y={94}
    >
      post.published
    </text>
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
    <rect className="fill-muted" height={28} rx={9} width={168} x={32} y={34} />
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
  { meta: 'Forum · 18 replies', title: 'How to ask a great question' },
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
      <circle className="fill-red-500 drop-shadow-md" cx={116} cy={66} r={13} />
      <text
        className="fill-white text-xs font-bold"
        textAnchor="middle"
        x={116}
        y={70}
      >
        3
      </text>
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
        width={200}
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
        New reply to your post
      </text>
      <text className="fill-muted-foreground text-xs" x={290} y={82}>
        Alex · just now
      </text>
    </g>

    <g className="mk-anim-toast" style={delay(3)}>
      <rect
        className="fill-card stroke-border drop-shadow-md"
        height={64}
        rx={14}
        strokeWidth={1.5}
        width={200}
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
        Mia mentioned you
      </text>
      <text className="fill-muted-foreground text-xs" x={290} y={158}>
        in #introductions
      </text>
    </g>

    <rect
      className="fill-card stroke-border"
      height={44}
      rx={12}
      strokeWidth={1.5}
      width={88}
      x={456}
      y={46}
    />
    <circle
      className="mk-anim-twinkle mk-origin-center fill-emerald-500"
      cx={472}
      cy={68}
      r={4}
    />
    <text className="fill-foreground text-xs font-semibold" x={482} y={65}>
      1,204
    </text>
    <text className="fill-muted-foreground text-xs" x={482} y={80}>
      online now
    </text>

    <rect
      className="fill-card stroke-border"
      height={44}
      rx={12}
      strokeWidth={1.5}
      width={88}
      x={456}
      y={112}
    />
    <text className="fill-foreground text-xs font-semibold" x={468} y={131}>
      1 socket
    </text>
    <text className="fill-muted-foreground text-xs" x={468} y={146}>
      every tab
    </text>

    <text
      className="fill-muted-foreground text-xs"
      textAnchor="middle"
      x={88}
      y={186}
    >
      Cookie-authenticated
    </text>
  </Visual>
)
