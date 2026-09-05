import type { LucideIcon } from 'lucide-react'

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

import type { SiteLinkComponent } from '#/site/home/site-link'

import { PluginDiagram } from '#/site/home/illustrations/plugin-diagram'
import { InfiniteSlider } from '#/site/home/infinite-slider'
import {
  MarketingSection,
  SectionHeading,
  TextLink,
} from '#/site/marketing/shared'

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

export const PluginsSection = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <div className="bg-muted/40 border-y">
    <MarketingSection id="plugins" labelledBy="plugins-title">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-8">
          <SectionHeading
            eyebrow="The plugin system"
            id="plugins-title"
            title="Big ideas. Small, swappable pieces."
          >
            Your community should not outgrow its own software. In VitNode every
            feature is a plugin, so adding the next big thing never means
            rewriting the last one.
          </SectionHeading>

          <ul className="flex flex-col gap-3">
            {BENEFITS.map((benefit) => (
              <li className="flex items-start gap-3" key={benefit}>
                <span className="bg-primary/10 text-primary mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
                  <Check aria-hidden className="size-3.5" strokeWidth={3} />
                </span>
                <span className="text-sm leading-relaxed text-pretty sm:text-base">
                  {benefit}
                </span>
              </li>
            ))}
          </ul>

          <TextLink
            href="/docs/dev/plugins/create"
            LinkComponent={LinkComponent}
          >
            Meet your first plugin
          </TextLink>
        </div>

        <div className="bg-card rounded-3xl border p-4 sm:p-6">
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
                className="bg-card flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold whitespace-nowrap"
                key={label}
              >
                <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                  <Icon aria-hidden className="size-4" />
                </span>
                {label}
              </span>
            ))}
          </InfiniteSlider>
          <div className="from-muted/40 pointer-events-none absolute inset-y-0 left-0 w-16 bg-linear-to-r" />
          <div className="from-muted/40 pointer-events-none absolute inset-y-0 right-0 w-16 bg-linear-to-l" />
        </div>
      </div>
    </MarketingSection>
  </div>
)
