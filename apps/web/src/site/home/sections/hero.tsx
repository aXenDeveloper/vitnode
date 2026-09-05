import { ArrowRight, Bot, Scale, Server } from 'lucide-react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import { HeroOrbit } from '#/site/home/illustrations/hero-orbit'
import { MarketingActions } from '#/site/marketing/shared'

const TRUST = [
  { Icon: Scale, label: 'MIT licence, free forever' },
  { Icon: Server, label: 'Self-host or bring your cloud' },
  { Icon: Bot, label: 'Made for AI coding agents' },
]

export const HeroSection = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <section aria-labelledby="hero-title" className="relative overflow-hidden">
    <div aria-hidden className="mk-grid absolute inset-0 -z-10" />
    <div
      aria-hidden
      className="mk-anim-drift bg-primary/20 absolute top-0 left-1/2 -z-10 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
    />

    <div className="container mx-auto grid items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:py-28">
      <div className="flex flex-col gap-6">
        <LinkComponent
          className="bg-primary/10 text-primary hover:bg-primary/15 inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-colors"
          href="/docs/dev"
        >
          <span aria-hidden className="relative flex size-2">
            <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-75" />
            <span className="bg-primary relative inline-flex size-2 rounded-full" />
          </span>
          VitNode 2.0 Canary · a very early build
          <ArrowRight aria-hidden className="size-3.5" />
        </LinkComponent>

        <h1
          className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          id="hero-title"
        >
          Build the community <span className="text-primary">your people</span>{' '}
          deserve.
        </h1>

        <p className="text-muted-foreground max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
          VitNode is a free, open-source community framework. Members, roles,
          content, live notifications, search and an Admin Control Panel come in
          the box. Your ideas go on top. Plugins hold it all together.
        </p>

        <MarketingActions LinkComponent={LinkComponent} />

        <ul className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {TRUST.map(({ Icon, label }) => (
            <li className="flex items-center gap-2" key={label}>
              <Icon aria-hidden className="text-primary size-4" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-center lg:justify-end">
        <HeroOrbit />
      </div>
    </div>
  </section>
)
