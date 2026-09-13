import type { LucideIcon } from 'lucide-react'

import { cn } from 'cn'
import { Compass, Gavel, UserRound, UsersRound } from 'lucide-react'

import type { Surface } from '@/site/marketing/shared'

import {
  ActionLink,
  MarketingSection,
  SectionHeading,
  SectionRow,
  SURFACE,
} from '@/site/marketing/shared'

const CARDS: {
  Icon: LucideIcon
  status: 'Included' | 'On the roadmap'
  surface: Surface
  text: string
  title: string
}[] = [
  {
    Icon: UsersRound,
    status: 'Included',
    surface: 'dark',
    text: 'Primary and secondary groups, coloured names and sensible seeded defaults. Organise people the way your community actually works.',
    title: 'Member roles',
  },
  {
    Icon: Gavel,
    status: 'On the roadmap',
    surface: 'soft',
    text: 'Moderators already have their own permission set in the AdminCP. A dedicated moderation workspace is one of the next things being built.',
    title: 'Moderator CP',
  },
  {
    Icon: UserRound,
    status: 'Included',
    surface: 'tint',
    text: 'Registration, sign-in, password reset, social login and device sessions are ready before you write your first page.',
    title: 'Accounts & sessions',
  },
  {
    Icon: Compass,
    status: 'Included',
    surface: 'soft',
    text: 'A site-wide activity feed every plugin can publish into, so members always find the newest thing worth their time.',
    title: 'Discover feed',
  },
]

export const CommunitySection = () => (
  <MarketingSection id="community" labelledBy="community-title">
    <SectionRow
      action={
        <ActionLink
          params={{ _splat: 'dev/working-with-users/roles' }}
          to="/docs/$"
        >
          See how roles work
        </ActionLink>
      }
    >
      <SectionHeading
        eyebrow="Made for people, managed by people"
        id="community-title"
        title="A community. With less chaos."
      >
        Members sign up, get roles and earn trust. Your team keeps the place
        healthy from a panel built for the job, not from a spreadsheet and a
        prayer.
      </SectionHeading>
    </SectionRow>

    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map(({ Icon, status, surface, text, title }) => (
        <li
          className={cn(SURFACE[surface], 'flex flex-col gap-5 p-7')}
          key={title}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-2xl">
              <Icon aria-hidden className="size-5" />
            </span>
            <span
              className={
                status === 'Included'
                  ? 'bg-primary/15 text-success rounded-full px-2.5 py-1 text-xs font-semibold'
                  : 'bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs font-semibold'
              }
            >
              {status}
            </span>
          </div>
          <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
          <p className="text-muted-foreground font-book leading-relaxed text-pretty">
            {text}
          </p>
        </li>
      ))}
    </ul>
  </MarketingSection>
)
