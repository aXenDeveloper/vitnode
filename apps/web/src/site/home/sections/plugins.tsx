import type { LucideIcon } from 'lucide-react'

import { cn } from 'cn'
import {
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarDays,
  Check,
  Images,
  Mail,
  Megaphone,
  PenLine,
  ShoppingBag,
  Star,
  Ticket,
  Trophy,
} from 'lucide-react'

import { PluginDiagram } from '@/site/home/illustrations/plugin-diagram'
import { InfiniteSlider } from '@/site/home/infinite-slider'
import {
  ActionLink,
  MarketingSection,
  SectionHeading,
  SectionRow,
  SURFACE,
} from '@/site/marketing/shared'

const BENEFITS = [
  'A feature keeps its pages, API, data, translations and admin screens together.',
  'Install a plugin and its screens appear in the AdminCP. Its records can publish into the search index and the Discover feed.',
  'Build it once, reuse it across every community you run.',
]

export const PLUGIN_IDEAS: { Icon: LucideIcon; label: string }[] = [
  { Icon: PenLine, label: 'Blog' },
  { Icon: Star, label: 'Reviews' },
  { Icon: Images, label: 'Gallery' },
  { Icon: ShoppingBag, label: 'Shop' },
  { Icon: CalendarDays, label: 'Events' },
  { Icon: Mail, label: 'Newsletter' },
  { Icon: BookOpen, label: 'Knowledge base' },
  { Icon: Briefcase, label: 'Job board' },
  { Icon: BarChart3, label: 'Polls' },
  { Icon: Trophy, label: 'Leaderboard' },
  { Icon: Ticket, label: 'Support desk' },
  { Icon: Megaphone, label: 'Announcements' },
]

export const PluginsSection = () => (
  <MarketingSection id="plugins" labelledBy="plugins-title">
    <SectionRow
      action={
        <ActionLink params={{ _splat: 'dev/plugins/create' }} to="/docs/$">
          Meet your first plugin
        </ActionLink>
      }
    >
      <SectionHeading
        eyebrow="The plugin system"
        id="plugins-title"
        title="Big ideas. Small, swappable pieces."
      >
        Your community should not outgrow its own software. In VitNode every
        feature is a plugin, so adding the next big thing never means rewriting
        the last one.
      </SectionHeading>
    </SectionRow>

    <div className="grid items-center gap-6 lg:grid-cols-5">
      <ul
        className={cn(
          SURFACE.soft,
          'flex flex-col gap-5 p-7 sm:p-8 lg:col-span-2',
        )}
      >
        {BENEFITS.map((benefit) => (
          <li className="flex items-start gap-3" key={benefit}>
            <span className="bg-primary/10 text-primary mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
              <Check aria-hidden className="size-3.5" strokeWidth={3} />
            </span>
            <span className="font-book leading-relaxed text-pretty">
              {benefit}
            </span>
          </li>
        ))}
      </ul>

      <div className={cn(SURFACE.tint, 'p-4 sm:p-6 lg:col-span-3')}>
        <PluginDiagram />
      </div>
    </div>

    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-center text-sm font-medium">
        What could a plugin be? Anything your community asks for next.
      </p>

      <div className="relative">
        <InfiniteSlider gap={12} speed={36} speedOnHover={12}>
          {PLUGIN_IDEAS.map(({ Icon, label }) => (
            <span
              className="bg-muted/60 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium whitespace-nowrap"
              key={label}
            >
              <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                <Icon aria-hidden className="size-4" />
              </span>
              {label}
            </span>
          ))}
        </InfiniteSlider>
        <div className="from-background pointer-events-none absolute inset-y-0 left-0 w-16 bg-linear-to-r" />
        <div className="from-background pointer-events-none absolute inset-y-0 right-0 w-16 bg-linear-to-l" />
      </div>
    </div>
  </MarketingSection>
)
