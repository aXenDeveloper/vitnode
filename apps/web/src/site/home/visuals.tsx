import type { ReactNode } from 'react'

import {
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  CircleDot,
  FileText,
  Globe2,
  Layers,
  MessageCircle,
  Search,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react'

import type { SiteLinkComponent } from '#/site/home/site-link'

const Svg = ({
  children,
  className = '',
  viewBox = '0 0 320 180',
}: {
  children: ReactNode
  className?: string
  viewBox?: string
}) => (
  <svg
    className={`feature-svg ${className}`}
    viewBox={viewBox}
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
)

export const CommunityPreview = () => (
  <div className="community-preview">
    <div className="preview-top">
      <span className="preview-brand">
        <Layers size={20} aria-hidden /> The good place
      </span>
      <span className="small-label">Your community</span>
    </div>
    <div className="preview-body">
      <div className="preview-nav" aria-hidden>
        <span className="active">
          <MessageCircle size={16} /> Community
        </span>
        <span>
          <BookOpen size={16} /> Knowledge
        </span>
        <span>
          <Users size={16} /> Members
        </span>
        <span>
          <Sparkles size={16} /> What’s new
        </span>
        <div className="preview-nav-bottom">
          <span className="avatar">Y</span> Yours, by design.
        </div>
      </div>
      <div className="preview-feed">
        <div className="preview-welcome">
          <span className="eyebrow">A place to belong</span>
          <strong>
            Good people.
            <br />
            Great conversations.
          </strong>
          <span>Make yourself at home.</span>
        </div>
        <div className="preview-post">
          <div className="post-author">
            <span className="avatar">JD</span>
            <div>
              <strong>Jamie</strong>
              <span>Just getting started</span>
            </div>
            <span className="post-tag">Welcome</span>
          </div>
          <p>Found my people. Also, who brought the snacks?</p>
          <div className="post-reactions">
            <span>♡ 12</span>
            <span>
              <MessageCircle size={14} aria-hidden /> 4 replies
            </span>
          </div>
        </div>
        <div className="preview-post compact-post">
          <div className="post-author">
            <span className="avatar neutral-avatar">AL</span>
            <div>
              <strong>Alex</strong>
              <span>Sharing something useful</span>
            </div>
          </div>
          <p>The guide I wish I had on day one.</p>
          <span className="resource-link">
            <FileText size={14} aria-hidden /> Getting started, together ↗
          </span>
        </div>
      </div>
    </div>
    <div className="preview-notification">
      <Bell size={18} aria-hidden />
      <div>
        <strong>A little connection. In real time.</strong>
        <span>Jamie replied to your post.</span>
      </div>
      <Check size={16} aria-hidden />
    </div>
  </div>
)

const ContentVisual = () => (
  <div className="content-visual">
    <div className="content-toolbar">
      <span>
        <Layers size={16} aria-hidden /> Your content studio
      </span>
      <span className="small-label">One definition. More done.</span>
    </div>
    <div className="content-table">
      <div className="content-table-head">
        <span>Content</span>
        <span>Status</span>
        <span>Language</span>
      </div>
      {[
        ['A very warm welcome', 'Published', 'EN · PL'],
        ['The community field guide', 'Draft', 'EN'],
        ['Something worth sharing', 'Scheduled', 'EN · PL'],
      ].map(([title, status, language]) => (
        <div key={title}>
          <span>
            <FileText size={16} aria-hidden />
            {title}
          </span>
          <span
            className={`content-status ${status === 'Published' ? 'published' : ''}`}
          >
            {status}
          </span>
          <span>{language}</span>
        </div>
      ))}
    </div>
    <Svg viewBox="0 0 520 100" className="content-flow">
      <path
        className="svg-line"
        d="M85 25 H435 M85 25 V55 M260 25 V55 M435 25 V55"
      />
      <path className="svg-signal" d="M85 25 H435" />
      {['Content', 'Admin screens', 'Search & delivery'].map((label, index) => (
        <g key={label}>
          <rect
            className="svg-surface"
            x={index * 175 + 15}
            y="48"
            width="140"
            height="36"
            rx="8"
          />
          <text x={index * 175 + 85} y="71">
            {label}
          </text>
        </g>
      ))}
    </Svg>
  </div>
)

const LanguageVisual = () => (
  <Svg>
    <ellipse className="svg-line" cx="160" cy="89" rx="61" ry="61" />
    <ellipse className="svg-line" cx="160" cy="89" rx="25" ry="61" />
    <path className="svg-line" d="M101 70 H219 M101 108 H219 M160 28 V150" />
    <g className="svg-float">
      <rect
        className="svg-surface"
        x="27"
        y="30"
        width="95"
        height="37"
        rx="9"
      />
      <text x="74" y="54">
        Hello!
      </text>
    </g>
    <g className="svg-float delay-one">
      <rect
        className="svg-accent-surface"
        x="194"
        y="80"
        width="103"
        height="39"
        rx="9"
      />
      <text x="245" y="105">
        Cześć!
      </text>
    </g>
    <g className="svg-float delay-two">
      <rect
        className="svg-surface"
        x="47"
        y="124"
        width="100"
        height="36"
        rx="9"
      />
      <text x="97" y="147">
        ¡Hola!
      </text>
    </g>
  </Svg>
)

const CacheVisual = () => (
  <Svg>
    <path
      className="svg-line"
      d="M43 123 C100 123 87 48 157 48 S215 123 277 123"
    />
    <path
      className="svg-signal"
      d="M43 123 C100 123 87 48 157 48 S215 123 277 123"
    />
    <rect
      className="svg-surface"
      x="112"
      y="70"
      width="96"
      height="49"
      rx="12"
    />
    <path
      className="svg-accent-stroke"
      d="M165 78 L147 98 H161 L155 111 L174 91 H160 Z"
    />
    <circle className="svg-endpoint" cx="43" cy="123" r="7" />
    <circle className="svg-endpoint" cx="277" cy="123" r="7" />
    <text x="160" y="151">
      Less waiting. More doing.
    </text>
  </Svg>
)

const EventVisual = () => (
  <Svg>
    <path
      className="svg-line"
      d="M77 88 H151 V38 H248 M151 88 H248 M151 88 V138 H248"
    />
    <path
      className="svg-signal"
      d="M77 88 H151 V38 H248 M151 88 H248 M151 88 V138 H248"
    />
    <rect
      className="svg-accent-surface"
      x="25"
      y="66"
      width="103"
      height="44"
      rx="10"
    />
    <text x="76" y="93">
      Published
    </text>
    {['Update search', 'Clear cache', 'Notify people'].map((label, index) => (
      <g key={label}>
        <rect
          className="svg-surface"
          x="188"
          y={index * 50 + 19}
          width="119"
          height="38"
          rx="8"
        />
        <text x="248" y={index * 50 + 43}>
          {label}
        </text>
      </g>
    ))}
  </Svg>
)

const AiVisual = () => (
  <Svg>
    <rect
      className="svg-surface"
      x="26"
      y="23"
      width="268"
      height="134"
      rx="12"
    />
    <path className="svg-line" d="M47 52 H237 M47 66 H262 M47 80 H208" />
    <path
      className="svg-accent-stroke svg-draw"
      d="M47 110 H223 M47 124 H168"
    />
    <path
      className="svg-accent-stroke svg-spark"
      d="M254 95 L258 108 L271 112 L258 116 L254 129 L250 116 L237 112 L250 108 Z"
    />
    <circle className="svg-endpoint" cx="277" cy="137" r="3" />
  </Svg>
)

const SearchVisual = () => (
  <Svg>
    <rect
      className="svg-surface"
      x="24"
      y="18"
      width="272"
      height="42"
      rx="10"
    />
    <circle className="svg-accent-stroke" cx="45" cy="36" r="6" />
    <path className="svg-accent-stroke" d="M49 41 L55 47" />
    <text className="svg-text-start" x="68" y="44">
      That really helpful guide…
    </text>
    {[83, 112, 141].map((y, index) => (
      <g className={`svg-float delay-${index === 0 ? 'one' : 'two'}`} key={y}>
        <rect
          className="svg-soft"
          x="26"
          y={y - 9}
          width="19"
          height="19"
          rx="4"
        />
        <path
          className="svg-line"
          d={`M58 ${y - 3} H${252 - index * 34} M58 ${y + 6} H${187 - index * 27}`}
        />
      </g>
    ))}
  </Svg>
)

const RealtimeVisual = () => (
  <Svg>
    <path
      className="svg-line"
      d="M39 98 H130 Q147 98 147 80 V61 Q147 46 162 46 H279"
    />
    <path
      className="svg-signal"
      d="M39 98 H130 Q147 98 147 80 V61 Q147 46 162 46 H279"
    />
    <circle className="svg-endpoint" cx="39" cy="98" r="8" />
    <rect
      className="svg-surface svg-float"
      x="90"
      y="76"
      width="204"
      height="73"
      rx="12"
    />
    <text className="svg-text-start" x="109" y="103">
      You’re in the conversation.
    </text>
    <text className="svg-text-start svg-muted-text" x="109" y="127">
      New reply · just now
    </text>
    <circle className="svg-endpoint" cx="279" cy="46" r="6" />
  </Svg>
)

const features = [
  {
    title: 'Content Engine',
    heading: 'An idea goes in. A whole lot comes out.',
    text: 'Articles, guides, directories—give your content a shape and get the tools to manage it. Forms, tables, permissions, drafts, and translations. Less busywork, more publishing.',
    href: '/docs/dev/content-engine',
    Icon: Layers,
    Visual: ContentVisual,
    wide: true,
  },
  {
    title: 'Internationalization',
    heading: 'Hello, whole world.',
    text: 'Make your community feel local with translated interfaces and multilingual content.',
    href: '/docs/dev/i18n',
    Icon: Globe2,
    Visual: LanguageVisual,
  },
  {
    title: 'Cache',
    heading: 'Skip the encore request.',
    text: 'Keep repeat visits snappy with app caching and optional Redis-backed data caching.',
    href: '/docs/dev/cache',
    Icon: Zap,
    Visual: CacheVisual,
  },
  {
    title: 'Events',
    heading: 'One action. Good reactions.',
    text: 'Let your plugins respond when something happens, so connected workflows stay in step.',
    href: '/docs/dev/events',
    Icon: CircleDot,
    Visual: EventVisual,
  },
  {
    title: 'AI building blocks',
    heading: 'A little help, on your terms.',
    text: 'Build summaries, writing tools, and streaming answers with your choice of AI provider.',
    href: '/docs/dev/ai',
    Icon: Sparkles,
    Visual: AiVisual,
  },
  {
    title: 'Search engine',
    heading: 'Less “where was that?”',
    text: 'Make useful content discoverable across plugins with Postgres or Elasticsearch search.',
    href: '/docs/dev/search',
    Icon: Search,
    Visual: SearchVisual,
  },
  {
    title: 'WebSockets & notifications',
    heading: 'Good news travels live.',
    text: 'Deliver live updates and in-app notifications without asking people to hit refresh. Requires a compatible server.',
    href: '/docs/dev/websocket',
    Icon: Bell,
    Visual: RealtimeVisual,
  },
]

export const FeatureGrid = ({
  LinkComponent: Link,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <div className="feature-grid">
    {features.map(({ title, heading, text, href, Icon, Visual, wide }) => (
      <article
        className={`feature-card ${wide ? 'feature-card-wide' : ''}`}
        key={title}
      >
        <div className="feature-card-label">
          <Icon size={18} aria-hidden />
          <span>{title}</span>
          <ArrowUpRight size={16} aria-hidden />
        </div>
        <div className="feature-art">
          <Visual />
        </div>
        <div className="feature-card-copy">
          <h3>
            <Link href={href}>{heading}</Link>
          </h3>
          <p>{text}</p>
        </div>
      </article>
    ))}
  </div>
)

export const PluginDiagram = () => (
  <Svg viewBox="0 0 480 330" className="plugin-diagram">
    <path
      className="svg-line"
      d="M135 67 H240 V265 H345 M240 67 H345 M135 165 H345 M135 265 H240"
    />
    <path
      className="svg-signal"
      d="M135 67 H240 V265 H345 M240 67 H345 M135 165 H345 M135 265 H240"
    />
    {[
      ['Pages', 25, 43],
      ['API', 335, 43],
      ['Content', 25, 141],
      ['AdminCP', 335, 141],
      ['Translations', 25, 241],
      ['Permissions', 335, 241],
    ].map(([label, x, y]) => (
      <g key={label}>
        <rect
          className="svg-surface"
          x={Number(x)}
          y={Number(y)}
          width="120"
          height="48"
          rx="12"
        />
        <text x={Number(x) + 60} y={Number(y) + 30}>
          {label}
        </text>
      </g>
    ))}
    <rect
      className="svg-accent-surface"
      x="179"
      y="109"
      width="122"
      height="112"
      rx="20"
    />
    <path
      className="svg-accent-stroke"
      d="M226 139 H236 V133 A6 6 0 0 1 248 133 V139 H258 V151 H264 A6 6 0 0 1 264 163 H258 V175 H246 V169 A6 6 0 0 0 234 169 V175 H222 V163 H216 A6 6 0 0 1 216 151 H226 Z"
    />
    <text x="240" y="202">
      Your plugin
    </text>
  </Svg>
)

export const AgentPreview = () => (
  <div className="agent-preview">
    <div className="window-bar">
      <span>
        <Sparkles size={16} aria-hidden /> Your AI coding workspace
      </span>
      <span className="small-label">Illustration</span>
    </div>
    <div className="agent-prompt">
      Let’s build a knowledge hub for our community.
    </div>
    <div className="agent-response">
      <Sparkles size={18} aria-hidden />
      <div>
        <strong>A shared foundation. A clear next step.</strong>
        <p>
          Start with the docs, follow the conventions, and keep the feature
          inside its plugin.
        </p>
      </div>
    </div>
    <div className="agent-files">
      {[
        ['AGENTS.md', 'Project conventions'],
        ['llms-full.txt', 'The full documentation'],
        ['plugins/knowledge/', 'Your feature’s home'],
      ].map(([file, caption]) => (
        <div key={file}>
          <FileText size={16} aria-hidden />
          <code>{file}</code>
          <span>{caption}</span>
          <Check size={16} aria-hidden />
        </div>
      ))}
    </div>
    <Svg viewBox="0 0 360 54">
      <path className="svg-line" d="M24 27 H336" />
      <path className="svg-signal" d="M24 27 H336" />
      <circle className="svg-endpoint" cx="24" cy="27" r="4" />
      <circle className="svg-endpoint" cx="336" cy="27" r="4" />
    </Svg>
    <p className="visual-caption">
      You bring the agent. VitNode brings the context.
    </p>
  </div>
)

export const SecurityDiagram = () => (
  <Svg viewBox="0 0 420 350">
    <path
      className="svg-line"
      d="M82 78 H157 M263 78 H338 M82 267 H157 M263 267 H338 M210 88 V134 M210 214 V267"
    />
    <circle className="svg-line" cx="210" cy="174" r="109" />
    <circle className="svg-line" cx="210" cy="174" r="83" />
    <path
      className="svg-accent-surface"
      d="M210 121 L254 139 V171 C254 205 229 223 210 232 C191 223 166 205 166 171 V139 Z"
    />
    <path
      className="svg-accent-stroke svg-draw"
      d="M189 174 L204 189 L232 160"
    />
    {[
      ['Sign in', 30, 57],
      ['CAPTCHA', 282, 57],
      ['Roles', 30, 246],
      ['Permissions', 282, 246],
    ].map(([label, x, y]) => (
      <g key={label}>
        <rect
          className="svg-surface"
          x={Number(x)}
          y={Number(y)}
          width="110"
          height="42"
          rx="10"
        />
        <text x={Number(x) + 55} y={Number(y) + 27}>
          {label}
        </text>
      </g>
    ))}
  </Svg>
)
