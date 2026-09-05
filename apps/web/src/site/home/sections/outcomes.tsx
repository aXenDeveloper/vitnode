import { KeyRound, Rocket, TrendingUp } from 'lucide-react'

import { MarketingSection, SectionHeading } from '#/site/marketing/shared'

const OUTCOMES = [
  {
    Icon: Rocket,
    text: 'Accounts, roles, admin screens, translations, search and notifications are already built. Your team starts at the interesting part.',
    title: 'Launch in weeks, not quarters',
  },
  {
    Icon: KeyRound,
    text: 'No per-member fees, no vendor lock-in, no surprise plan changes. Your members and your data live in your own Postgres.',
    title: 'Own the platform, keep the relationship',
  },
  {
    Icon: TrendingUp,
    text: 'Every feature is a plugin. Add a forum, a shop or a knowledge base next year without turning the whole app upside down.',
    title: 'Grow without the rewrite',
  },
]

export const OutcomesSection = () => (
  <MarketingSection labelledBy="outcomes-title">
    <SectionHeading
      align="center"
      eyebrow="Why teams pick VitNode"
      id="outcomes-title"
      title="Less plumbing. More community."
    >
      Most community projects die in month three, buried under login forms and
      admin tables. VitNode ships those parts already done, so the budget goes
      into the parts your members actually notice.
    </SectionHeading>

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
