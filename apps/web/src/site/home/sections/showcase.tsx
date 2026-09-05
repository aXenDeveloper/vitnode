import { Bug, LayoutDashboard, ListTodo, UsersRound } from 'lucide-react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import adminDashboardDark from '#/site/home/assets/admin-dashboard-dark.png'
import adminDashboardLight from '#/site/home/assets/admin-dashboard-light.png'
import {
  MarketingSection,
  SectionHeading,
  TextLink,
} from '#/site/marketing/shared'

const HIGHLIGHTS = [
  {
    Icon: LayoutDashboard,
    text: 'A dashboard you rearrange yourself. Plugins add their own widgets.',
    title: 'Widgets, your way',
  },
  {
    Icon: UsersRound,
    text: 'Users, roles and staff in one place, with per-plugin permissions.',
    title: 'People management',
  },
  {
    Icon: ListTodo,
    text: 'Content types get list, create and edit screens without a line of UI code.',
    title: 'Content screens for free',
  },
  {
    Icon: Bug,
    text: 'Logs, cron runs, queue tasks and cache controls when production gets weird.',
    title: 'Debug panel',
  },
]

const ALT =
  'The VitNode Admin Control Panel dashboard with the sidebar listing Core, Blog and Example plugin sections, a private notes widget and a send-notification widget.'

export const ShowcaseSection = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <MarketingSection id="admincp" labelledBy="showcase-title">
    <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <SectionHeading
        eyebrow="The real product, not a mockup"
        id="showcase-title"
        title="Meet your community’s control room."
      >
        Every plugin gets a home in the Admin Control Panel: users, roles,
        staff, content, cron, queues, logs. One place, fewer “where do I change
        this?” messages.
      </SectionHeading>

      <TextLink
        className="shrink-0"
        href="/docs/dev/plugins/admin"
        LinkComponent={LinkComponent}
      >
        Explore the AdminCP docs
      </TextLink>
    </div>

    <figure className="flex flex-col gap-4">
      <div className="bg-card overflow-hidden rounded-3xl border shadow-xl">
        <div className="bg-muted/60 flex items-center gap-2 border-b px-4 py-3">
          <span aria-hidden className="flex gap-1.5">
            <span className="size-3 rounded-full bg-red-400/80" />
            <span className="size-3 rounded-full bg-amber-400/80" />
            <span className="size-3 rounded-full bg-emerald-400/80" />
          </span>
          <span className="bg-background text-muted-foreground mx-auto rounded-md px-3 py-1 font-mono text-xs">
            yourcommunity.com/admin
          </span>
        </div>

        <img
          alt={ALT}
          className="block w-full dark:hidden"
          decoding="async"
          height={933}
          loading="lazy"
          src={adminDashboardLight}
          width={1920}
        />
        <img
          alt={ALT}
          className="hidden w-full dark:block"
          decoding="async"
          height={933}
          loading="lazy"
          src={adminDashboardDark}
          width={1920}
        />
      </div>

      <figcaption className="text-muted-foreground text-center text-sm">
        VitNode 2.0 canary AdminCP. Yes, the notification widget really pushes a
        toast to a signed-in member in real time.
      </figcaption>
    </figure>

    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {HIGHLIGHTS.map(({ Icon, text, title }) => (
        <li className="flex flex-col gap-3" key={title}>
          <div className="flex items-center gap-2">
            <Icon aria-hidden className="text-primary size-4" />
            <h3 className="text-sm font-semibold">{title}</h3>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {text}
          </p>
        </li>
      ))}
    </ul>
  </MarketingSection>
)
