import { Link } from '@tanstack/react-router'
import { buttonVariants } from '@vitnode/core/components/ui/button'
import { cn } from 'cn'
import { Check, Coffee, HeartHandshake } from 'lucide-react'

import { REPOSITORY_URL, SPONSOR_URL } from '@/site/marketing/links'
import {
  BUTTON,
  Eyebrow,
  GitHubIcon,
  MarketingSection,
  SURFACE,
} from '@/site/marketing/shared'

const INCLUDED = [
  'The whole framework, every feature, no tiers',
  'Commercial use under the MIT licence',
  'Unlimited members, admins and plugins',
  'Self-host or bring your own cloud',
]

export const PricingSection = () => (
  <MarketingSection id="pricing" labelledBy="pricing-title">
    <div
      className={cn(
        SURFACE.tint,
        'relative flex flex-col items-center gap-6 overflow-hidden px-6 py-16 text-center sm:py-20',
      )}
    >
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

      <p className="text-muted-foreground font-book max-w-xl text-lg leading-relaxed text-pretty">
        No plans, no seats, no “contact sales” button. The entire framework for
        every member you will ever have. You can still make your contribution: a
        pull request, a bug report, or a donation that keeps the maintainer
        caffeinated.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          className={cn(buttonVariants({ size: 'lg' }), BUTTON)}
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
            BUTTON,
          )}
          href={SPONSOR_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Coffee aria-hidden />
          Donate
        </a>
        <Link
          className={cn(
            buttonVariants({ size: 'lg', variant: 'outline' }),
            BUTTON,
          )}
          params={{ _splat: 'dev/contribution' }}
          to="/docs/$"
        >
          <HeartHandshake aria-hidden />
          Contribute
        </Link>
      </div>

      <ul className="grid gap-x-8 gap-y-2 text-left font-book sm:grid-cols-2">
        {INCLUDED.map((item) => (
          <li className="flex items-start gap-2" key={item}>
            <Check
              aria-hidden
              className="text-success mt-1 size-4 shrink-0"
              strokeWidth={3}
            />
            {item}
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        Servers, databases and coffee still cost money. VitNode does not.
        Donations go through GitHub Sponsors, straight to the people building
        it.
      </p>
    </div>
  </MarketingSection>
)
