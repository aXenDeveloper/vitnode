import type { LucideIcon } from 'lucide-react'

import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import { KeyRound, Rocket, TrendingUp } from 'lucide-react'

import type { Surface } from '@/site/marketing/shared'

import {
  MarketingSection,
  SectionHeading,
  SURFACE,
} from '@/site/marketing/shared'

const OUTCOMES: {
  Icon: LucideIcon
  surface: Surface
  text: string
  title: string
}[] = [
  {
    Icon: Rocket,
    surface: 'tint',
    text: 'Accounts, roles, admin screens, translations, search and real-time updates are already built. Your team starts at the part your members will actually notice.',
    title: 'Launch in days, not quarters',
  },
  {
    Icon: KeyRound,
    surface: 'dark',
    text: 'No monthly licence, no per-seat pricing, no rented platform that can change the rules. Your members, your data and your code live with you.',
    title: 'Own the platform, keep the relationship',
  },
  {
    Icon: TrendingUp,
    surface: 'primary',
    text: 'Every feature is a plugin, written in TypeScript by your team or your agent. Add a shop, a course or a job board next year without a rewrite.',
    title: 'Grow without outgrowing it',
  },
]

const USE_CASES = [
  { label: 'Help center', slug: 'help-center' },
  { label: 'Membership site', slug: 'membership-site' },
  { label: 'Open-source hub', slug: 'open-source-hub' },
  { label: 'Gaming guild hub', slug: 'gaming-guild' },
  { label: 'Multilingual magazine', slug: 'multilingual-magazine' },
]

const ICON_BADGE: Record<Surface, string> = {
  dark: 'bg-primary/15 text-primary',
  primary: 'bg-primary-foreground/15 text-primary-foreground',
  soft: 'bg-primary/10 text-primary',
  tint: 'bg-primary/10 text-primary',
}

const BODY: Record<Surface, string> = {
  dark: 'text-muted-foreground',
  primary: 'text-primary-foreground/80',
  soft: 'text-muted-foreground',
  tint: 'text-muted-foreground',
}

export const OutcomesSection = () => (
  <MarketingSection labelledBy="outcomes-title">
    <SectionHeading
      align="center"
      eyebrow="Why teams pick VitNode"
      id="outcomes-title"
      title="Less plumbing. More community."
    >
      Most community projects die in month three, buried under login forms and
      admin tables, or end up renting a platform that owns the relationship.
      VitNode ships the boring parts done and hands you the keys.
    </SectionHeading>

    <ul className="flex flex-wrap justify-center gap-2">
      {USE_CASES.map(({ label, slug }) => (
        <li key={slug}>
          <Link
            className="bg-muted hover:bg-primary/10 hover:text-primary inline-flex rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors"
            params={{ slug }}
            to="/solutions/$slug"
          >
            {label}
          </Link>
        </li>
      ))}
    </ul>

    <ul className="grid gap-4 md:grid-cols-3">
      {OUTCOMES.map(({ Icon, surface, text, title }) => (
        <li
          className={cn(SURFACE[surface], 'flex flex-col gap-5 p-7 sm:p-8')}
          key={title}
        >
          <span
            className={cn(
              'flex size-11 items-center justify-center rounded-2xl',
              ICON_BADGE[surface],
            )}
          >
            <Icon aria-hidden className="size-5" />
          </span>
          <h3 className="text-xl font-semibold tracking-tight text-balance">
            {title}
          </h3>
          <p
            className={cn(
              'font-book leading-relaxed text-pretty',
              BODY[surface],
            )}
          >
            {text}
          </p>
        </li>
      ))}
    </ul>
  </MarketingSection>
)
