import { Link, type RegisteredRouter } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

import { MarketingPage } from '@/site/marketing/marketing-page'
import { ScreenFrame } from '@/site/marketing/screen-frame'
import { SCREENS } from '@/site/marketing/screens'
import {
  CanaryNotice,
  Eyebrow,
  HeroShell,
  MarketingActions,
  MarketingSection,
  SectionHeading,
  TextLink,
} from '@/site/marketing/shared'
import { SolutionSections } from '@/site/solutions/solution-page'

import type { PlatformPage as PlatformPageData } from './data'

import { PLATFORM_SLUGS, platformEntry } from './catalog'
import { PLATFORM_PAGES, WHY_VITNODE } from './data'

const PLATFORM_LINKS = [
  { description: WHY_VITNODE.title, name: 'Why VitNode', to: '/why-vitnode' },
  ...PLATFORM_SLUGS.map((slug) => ({
    description: PLATFORM_PAGES[slug].title,
    name: platformEntry(slug).name,
    to: `/platform/${slug}`,
  })),
]

const PlatformCard = ({
  description,
  name,
  to,
}: {
  description: string
  name: string
  to: string
}) => (
  <Link<RegisteredRouter, string, string>
    className="group bg-muted/60 hover:bg-primary/10 flex h-full flex-col gap-3 rounded-3xl p-6 transition-colors"
    href={to}
  >
    <span className="text-xl font-semibold tracking-tight">{name}</span>
    <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
      {description}
    </span>
    <span className="text-primary mt-auto inline-flex items-center gap-1 text-sm font-semibold">
      Read more
      <ArrowRight
        aria-hidden
        className="size-4 transition-transform group-hover:translate-x-0.5"
      />
    </span>
  </Link>
)

const PlatformCta = () => (
  <section
    aria-labelledby="platform-cta-title"
    className="container mx-auto px-4 pb-16 sm:px-6 sm:pb-24"
  >
    <div className="bg-muted/60 flex flex-col items-center gap-6 rounded-3xl px-6 py-16 text-center">
      <h2
        className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl"
        id="platform-cta-title"
      >
        Start with the boring parts already done.
      </h2>
      <p className="text-muted-foreground max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
        Scaffold an app, add the forum or the blog, and show it to your people
        this week. It costs nothing to try.
      </p>
      <MarketingActions className="justify-center" />
      <TextLink to="/solutions">See what you can build</TextLink>
    </div>
  </section>
)

export const PlatformPage = ({
  current,
  page,
}: {
  current: string
  page: PlatformPageData
}) => (
  <MarketingPage>
    <section
      aria-labelledby="platform-title"
      className="relative overflow-hidden"
    >
      <HeroShell>
        <Eyebrow>{page.eyebrow}</Eyebrow>
        <h1
          className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          id="platform-title"
        >
          {page.title}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed text-pretty sm:text-lg">
          {page.description}
        </p>
        <MarketingActions className="justify-center" />
        <div className="w-full max-w-5xl pt-6">
          <ScreenFrame priority screen={SCREENS[page.heroScreen]} />
        </div>
      </HeroShell>
    </section>

    <SolutionSections sections={page.sections} />

    <MarketingSection labelledBy="platform-more-title">
      <SectionHeading
        eyebrow="Explore"
        id="platform-more-title"
        title="More about the platform."
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORM_LINKS.filter((item) => item.to !== current).map((item) => (
          <li key={item.to}>
            <PlatformCard {...item} />
          </li>
        ))}
      </ul>
      <CanaryNotice />
    </MarketingSection>

    <PlatformCta />
  </MarketingPage>
)

export const PlatformIndexPage = () => (
  <MarketingPage>
    <section
      aria-labelledby="platform-index-title"
      className="relative overflow-hidden"
    >
      <HeroShell>
        <Eyebrow>Platform</Eyebrow>
        <h1
          className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          id="platform-index-title"
        >
          What every VitNode site starts with.
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed text-pretty sm:text-lg">
          The core, the AdminCP and the security layers that ship before you
          write a single plugin, plus the reasons people pick VitNode at all.
        </p>
      </HeroShell>
    </section>

    <MarketingSection labelledBy="platform-list-title">
      <h2 className="sr-only" id="platform-list-title">
        Platform pages
      </h2>
      <ul className="grid gap-4 md:grid-cols-2">
        {PLATFORM_LINKS.map((item) => (
          <li key={item.to}>
            <PlatformCard {...item} />
          </li>
        ))}
      </ul>
      <CanaryNotice />
    </MarketingSection>

    <PlatformCta />
  </MarketingPage>
)
