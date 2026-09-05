import type { LucideIcon } from 'lucide-react'

import { cn } from '@vitnode/core/lib/utils'
import { Bell, Boxes, Globe, Radio, Search, Sparkles, Zap } from 'lucide-react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import {
  AiVisual,
  CacheVisual,
  ContentEngineVisual,
  EventsVisual,
  I18nVisual,
  RealtimeVisual,
  SearchVisual,
} from '#/site/home/illustrations/feature-visuals'
import {
  MarketingSection,
  SectionHeading,
  TextLink,
} from '#/site/marketing/shared'

interface Feature {
  className?: string
  heading: string
  href: string
  Icon: LucideIcon
  text: string
  title: string
  Visual: () => React.ReactNode
}

const FEATURES: Feature[] = [
  {
    className: 'md:col-span-2 lg:row-span-2',
    heading: 'Describe it once. Ship the whole thing.',
    href: '/docs/dev/content-engine',
    Icon: Boxes,
    text: 'Describe a content type in one file and get the database table, a typed API, admin screens, search indexing and translations. Articles, listings, docs, events: anything with a shape.',
    title: 'Content Engine',
    Visual: ContentEngineVisual,
  },
  {
    heading: 'Hello, whole world.',
    href: '/docs/dev/i18n',
    Icon: Globe,
    text: 'Every screen, email and content field can speak your members’ language. Add a locale with one command.',
    title: 'Internationalization',
    Visual: I18nVisual,
  },
  {
    heading: 'Fast on the page. Fast on the API.',
    href: '/docs/dev/cache',
    Icon: Zap,
    text: 'A front-end query cache plus an optional Redis layer on the API. Pages stop re-asking for what they already know.',
    title: 'Cache',
    Visual: CacheVisual,
  },
  {
    heading: 'One action. Many good reactions.',
    href: '/docs/dev/events',
    Icon: Radio,
    text: 'Publish a post and let plugins react: send an email, refresh search, ping members. No spaghetti between features.',
    title: 'Events',
    Visual: EventsVisual,
  },
  {
    heading: 'AI on your terms.',
    href: '/docs/dev/ai',
    Icon: Sparkles,
    text: 'Summaries, drafts, streaming answers and embeddings with any provider through the Vercel AI SDK. You pick the model.',
    title: 'AI features',
    Visual: AiVisual,
  },
  {
    className: 'lg:col-span-2',
    heading: 'Less “where was that?”',
    href: '/docs/dev/search',
    Icon: Search,
    text: 'Site-wide search and a discovery feed across every plugin. Postgres out of the box, Elasticsearch when you outgrow it.',
    title: 'Search engine',
    Visual: SearchVisual,
  },
  {
    className: 'lg:col-span-2',
    heading: 'Good news travels live.',
    href: '/docs/dev/websocket',
    Icon: Bell,
    text: 'One authenticated WebSocket shared by every open tab pushes notifications, live counters and toasts. No refresh button required.',
    title: 'WebSockets & notifications',
    Visual: RealtimeVisual,
  },
]

export const FeaturesBentoSection = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <MarketingSection id="features" labelledBy="features-title">
    <SectionHeading
      align="center"
      eyebrow="Everything in the box"
      id="features-title"
      title="The good stuff, already wired together."
    >
      Seven building blocks that usually eat a year of roadmap. Yours on day
      one, and they already know how to talk to each other.
    </SectionHeading>

    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {FEATURES.map(
        ({ className, heading, href, Icon, text, title, Visual }) => (
          <article
            className={cn(
              'group bg-card hover:border-primary/40 flex flex-col gap-5 rounded-3xl border p-6 transition-colors',
              className,
            )}
            key={title}
          >
            <div className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                <Icon aria-hidden className="size-4" />
              </span>
              <h3 className="text-sm font-semibold">{title}</h3>
            </div>

            <div className="bg-muted/40 flex flex-1 items-center overflow-hidden rounded-2xl border p-3">
              <Visual />
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-lg font-semibold tracking-tight text-balance">
                {heading}
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                {text}
              </p>
              <TextLink href={href} LinkComponent={LinkComponent}>
                Learn more
              </TextLink>
            </div>
          </article>
        ),
      )}
    </div>
  </MarketingSection>
)
