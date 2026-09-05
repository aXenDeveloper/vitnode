import { LogoVitNode } from '@vitnode/core/components/logo-vitnode'
import {
  ArrowUpRight,
  BookOpen,
  Check,
  FileText,
  Globe2,
  Heart,
  LayoutDashboard,
  Puzzle,
  Users,
} from 'lucide-react'

export const CommunityPreview = () => (
  <figure className="home-preview w-full max-w-5xl">
    <div className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xl shadow-primary/5">
      <div className="flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3">
          <LogoVitNode
            aria-hidden
            className="size-7"
            idPrefix="home-preview"
            small
          />
          <span className="font-semibold">The Good Company</span>
        </div>
        <span className="home-pill hidden sm:inline-flex">
          Your community, your brand
        </span>
      </div>
      <div className="grid md:grid-cols-4">
        <div
          aria-hidden
          className="hidden flex-col gap-6 border-r bg-muted/30 p-6 text-foreground md:flex"
        >
          <p className="home-eyebrow">Our little corner</p>
          <div className="flex flex-col gap-5 text-sm">
            <span className="flex items-center gap-3 font-medium text-primary">
              <Heart className="size-4" />
              Welcome home
            </span>
            <span className="flex items-center gap-3 text-muted-foreground">
              <BookOpen className="size-4" />
              Journal
            </span>
            <span className="flex items-center gap-3 text-muted-foreground">
              <Users className="size-4" />
              Our people
            </span>
          </div>
          <div className="flex flex-col gap-2 border-t pt-5">
            <p className="text-sm font-medium">A place to belong.</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Coffee optional.
              <br />
              Good company included.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-6 p-5 text-left sm:p-7 md:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Welcome home</span>
            <span className="home-pill">Made with VitNode</span>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-3xl font-medium tracking-tight text-balance sm:text-4xl">
              Well, look who’s here.
            </h2>
            <p className="leading-relaxed text-pretty text-muted-foreground">
              A little inspiration. A few familiar faces. A place that’s ours.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-5">
            <div className="flex flex-col gap-5 rounded-xl border bg-primary/5 p-5 text-foreground sm:col-span-3">
              <span className="home-eyebrow">From the journal</span>
              <h3 className="text-xl font-medium text-balance">
                Big ideas start with
                <br />
                “what if we…”
              </h3>
              <div className="flex items-center gap-2 text-sm text-primary">
                <FileText aria-hidden className="size-4 shrink-0" />
                Stories worth sticking around for
              </div>
            </div>
            <div className="flex flex-col justify-between gap-5 rounded-xl border p-5 sm:col-span-2">
              <div aria-hidden className="flex flex-wrap gap-1">
                {['JD', 'MK', 'AL', 'TS'].map((initials) => (
                  <span
                    className="inline-flex size-9 items-center justify-center rounded-full border-2 border-card bg-muted text-xs font-medium text-foreground"
                    key={initials}
                  >
                    {initials}
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <p className="font-medium">People, not usernames.</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Give your regulars a place to feel at home.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Check aria-hidden className="size-4 text-primary" />
              Your space. A little more you.
            </span>
            <span className="flex items-center gap-2 text-primary">
              Powered by your ideas{' '}
              <ArrowUpRight aria-hidden className="size-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
    <figcaption className="pt-4 text-center text-sm leading-relaxed text-muted-foreground">
      One idea for your future community. Illustrative design, not a bundled
      theme.
    </figcaption>
  </figure>
)

export const PluginDiagram = () => (
  <div className="flex flex-1 flex-col justify-center gap-3 px-6 pb-6">
    <svg
      aria-labelledby="plugin-diagram-title plugin-diagram-description"
      className="w-full text-primary"
      role="img"
      viewBox="0 0 420 240"
    >
      <title id="plugin-diagram-title">
        Features connected through VitNode
      </title>
      <desc id="plugin-diagram-description">
        A blog, members, admin tools, and your own plugin share the same VitNode
        foundation.
      </desc>
      <g fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth="1.5">
        <path d="M90 58H140Q160 58 160 78V100Q160 120 180 120H210" />
        <path d="M330 58H280Q260 58 260 78V100Q260 120 240 120H210" />
        <path d="M90 182H140Q160 182 160 162V140Q160 120 180 120H210" />
        <path d="M330 182H280Q260 182 260 162V140Q260 120 240 120H210" />
      </g>
      <g
        className="home-connection"
        fill="none"
        stroke="currentColor"
        strokeDasharray="8 220"
        strokeWidth="2"
      >
        <path d="M90 58H140Q160 58 160 78V100Q160 120 180 120H210" />
        <path d="M330 58H280Q260 58 260 78V100Q260 120 240 120H210" />
        <path d="M90 182H140Q160 182 160 162V140Q160 120 180 120H210" />
        <path d="M330 182H280Q260 182 260 162V140Q260 120 240 120H210" />
      </g>
      <g fill="var(--card)" stroke="var(--border)">
        <rect height="56" rx="12" width="112" x="24" y="30" />
        <rect height="56" rx="12" width="112" x="284" y="30" />
        <rect height="56" rx="12" width="112" x="24" y="154" />
        <rect height="56" rx="12" width="112" x="284" y="154" />
        <rect height="64" rx="16" width="64" x="178" y="88" />
      </g>
      <BookOpen aria-hidden height="18" width="18" x="36" y="48" />
      <Users aria-hidden height="18" width="18" x="296" y="48" />
      <LayoutDashboard aria-hidden height="18" width="18" x="36" y="172" />
      <Puzzle aria-hidden height="18" width="18" x="296" y="172" />
      <Globe2 aria-hidden height="32" width="32" x="194" y="104" />
      <g fill="var(--foreground)" fontFamily="inherit" fontSize="14">
        <text x="62" y="63">
          Blog
        </text>
        <text x="322" y="63">
          People
        </text>
        <text x="62" y="187">
          Admin
        </text>
        <text x="322" y="187">
          Your idea
        </text>
      </g>
    </svg>
    <p className="text-center text-sm text-muted-foreground">
      One foundation. Your own combination.
    </p>
  </div>
)
