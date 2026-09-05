import { buttonVariants } from '@vitnode/core/components/ui/button'
import { cn } from '@vitnode/core/lib/utils'
import { Check, Coffee, HeartHandshake } from 'lucide-react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import { REPOSITORY_URL, SPONSOR_URL } from '#/site/marketing/links'
import { Eyebrow, GitHubIcon, MarketingSection } from '#/site/marketing/shared'

const INCLUDED = [
  'The whole framework, every feature, no tiers',
  'Commercial use under the MIT licence',
  'Unlimited members, admins and plugins',
  'Self-host or bring your own cloud',
]

export const PricingSection = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <MarketingSection id="pricing" labelledBy="pricing-title">
    <div className="bg-card relative flex flex-col items-center gap-6 overflow-hidden rounded-3xl border px-6 py-16 text-center sm:py-20">
      <div aria-hidden className="mk-dots absolute inset-0 -z-10 opacity-60" />
      <div
        aria-hidden
        className="mk-anim-drift bg-primary/15 absolute -top-32 left-1/2 -z-10 size-96 -translate-x-1/2 rounded-full blur-3xl"
      />

      <Eyebrow>Pricing</Eyebrow>
      <h2
        className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl"
        id="pricing-title"
      >
        Just kidding. VitNode is free and open source.
      </h2>

      <p className="flex items-baseline justify-center gap-2">
        <span className="text-primary text-7xl font-semibold tracking-tighter sm:text-8xl">
          $0
        </span>
        <span className="text-muted-foreground text-sm font-medium sm:text-base">
          forever · MIT licence
        </span>
      </p>

      <p className="text-muted-foreground max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
        No plans, no seats, no “contact sales” button. The entire framework for
        every member you will ever have. You can still make your contribution: a
        pull request, a bug report, or a donation that keeps the maintainer
        caffeinated.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          className={cn(buttonVariants({ size: 'lg' }), 'px-5')}
          href={REPOSITORY_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          <GitHubIcon />
          Star on GitHub
        </a>
        <a
          className={cn(
            buttonVariants({ size: 'lg', variant: 'outline' }),
            'px-5',
          )}
          href={SPONSOR_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Coffee aria-hidden />
          Donate
        </a>
        <LinkComponent
          className={cn(
            buttonVariants({ size: 'lg', variant: 'outline' }),
            'px-5',
          )}
          href="/docs/dev/contribution"
        >
          <HeartHandshake aria-hidden />
          Contribute
        </LinkComponent>
      </div>

      <ul className="grid gap-x-8 gap-y-2 text-left text-sm sm:grid-cols-2">
        {INCLUDED.map((item) => (
          <li className="flex items-start gap-2" key={item}>
            <Check
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              strokeWidth={3}
            />
            {item}
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
        Servers, databases and coffee still cost money. VitNode does not.
        Donations go through GitHub Sponsors, straight to the people building
        it.
      </p>
    </div>
  </MarketingSection>
)
