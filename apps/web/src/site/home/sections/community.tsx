import { Compass, Gavel, UserRound, UsersRound } from 'lucide-react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import {
  MarketingSection,
  SectionHeading,
  TextLink,
} from '#/site/marketing/shared'

const CARDS = [
  {
    Icon: UsersRound,
    status: 'Included',
    text: 'Primary and secondary groups, coloured name badges and sensible seeded defaults. Organise people the way your community actually works.',
    title: 'Member roles',
  },
  {
    Icon: Gavel,
    status: 'On the roadmap',
    text: 'Moderators already get their own role and permission set. A dedicated moderation workspace with reports and queues is next in line.',
    title: 'Moderator CP',
  },
  {
    Icon: UserRound,
    status: 'Included',
    text: 'Registration, sign-in, email verification, password reset and device sessions are ready before you write your first page.',
    title: 'Accounts & sessions',
  },
  {
    Icon: Compass,
    status: 'Included',
    text: 'A site-wide activity feed every plugin can publish into, so members always find the newest thing worth their time.',
    title: 'Discover feed',
  },
]

export const CommunitySection = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <MarketingSection id="community" labelledBy="community-title">
    <div className="grid gap-12 lg:grid-cols-5">
      <div className="flex flex-col gap-8 lg:col-span-2">
        <SectionHeading
          eyebrow="Made for people, managed by people"
          id="community-title"
          title="A community. With a little less chaos."
        >
          Members sign up, get roles and earn trust. Your team keeps the place
          healthy from a panel built for the job, not from a spreadsheet and a
          prayer.
        </SectionHeading>

        <TextLink
          href="/docs/dev/working-with-users/roles"
          LinkComponent={LinkComponent}
        >
          See how roles work
        </TextLink>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-3">
        {CARDS.map(({ Icon, status, text, title }) => (
          <li
            className="bg-card flex flex-col gap-4 rounded-3xl border p-6"
            key={title}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                <Icon aria-hidden className="size-5" />
              </span>
              <span
                className={
                  status === 'Included'
                    ? 'rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs font-semibold'
                }
              >
                {status}
              </span>
            </div>
            <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {text}
            </p>
          </li>
        ))}
      </ul>
    </div>
  </MarketingSection>
)
