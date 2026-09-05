import { KeyRound, Rocket, TrendingUp } from 'lucide-react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import { MarketingSection, SectionHeading } from '#/site/marketing/shared'

const OUTCOMES = [
  {
    Icon: Rocket,
    text: 'Accounts, roles, admin screens, translations, search and real-time updates are already built. Your team starts at the part your members will actually notice.',
    title: 'Launch in days, not quarters',
  },
  {
    Icon: KeyRound,
    text: 'No monthly licence, no per-seat pricing, no rented platform that can change the rules. Your members, your data and your code live with you.',
    title: 'Own the platform, keep the relationship',
  },
  {
    Icon: TrendingUp,
    text: 'Every feature is a plugin, written in TypeScript by your team or your agent. Add a shop, a course or a job board next year without a rewrite.',
    title: 'Grow without outgrowing it',
  },
]

const USE_CASES = [
  { href: '/solutions/help-center', label: 'Help center' },
  { href: '/solutions/membership-site', label: 'Membership site' },
  { href: '/solutions/open-source-hub', label: 'Open-source hub' },
  { href: '/solutions/gaming-guild', label: 'Gaming guild hub' },
  { href: '/solutions/multilingual-magazine', label: 'Multilingual magazine' },
]

export const OutcomesSection = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
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
      {USE_CASES.map(({ href, label }) => (
        <li key={href}>
          <LinkComponent
            className="bg-card hover:border-primary/40 hover:text-primary inline-flex rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
            href={href}
          >
            {label}
          </LinkComponent>
        </li>
      ))}
    </ul>

    <ul className="grid gap-4 md:grid-cols-3">
      {OUTCOMES.map(({ Icon, text, title }, index) => (
        <li
          className="bg-card flex flex-col gap-4 rounded-3xl border p-6 sm:p-8"
          key={title}
        >
          <div className="flex items-center justify-between">
            <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-2xl">
              <Icon aria-hidden className="size-5" />
            </span>
            <span className="text-muted-foreground font-mono text-sm">
              0{index + 1}
            </span>
          </div>
          <h3 className="text-xl font-semibold tracking-tight text-balance">
            {title}
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {text}
          </p>
        </li>
      ))}
    </ul>
  </MarketingSection>
)
