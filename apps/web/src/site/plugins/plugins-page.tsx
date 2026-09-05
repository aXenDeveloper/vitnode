import type { LucideIcon } from 'lucide-react'

import {
  Braces,
  Clock,
  Database,
  FlaskConical,
  Languages,
  LayoutDashboard,
  PenLine,
  Radio,
  Route,
  ShieldCheck,
} from 'lucide-react'

import type { SiteLinkComponent } from '#/site/home/site-link'
import type { ScreenKey } from '#/site/marketing/screens'

import { InfiniteSlider } from '#/site/home/infinite-slider'
import { PLUGIN_IDEAS } from '#/site/home/sections/plugins'
import { ScreenFrame } from '#/site/marketing/screen-frame'
import { SCREENS } from '#/site/marketing/screens'
import {
  CanaryNotice,
  Eyebrow,
  MarketingActions,
  MarketingSection,
  SectionHeading,
  TextLink,
} from '#/site/marketing/shared'

interface OfficialPlugin {
  description: string
  highlights: string[]
  Icon: LucideIcon
  name: string
  pkg: string
  screen: ScreenKey
  status: 'available' | 'reference'
}

const OFFICIAL_PLUGINS: OfficialPlugin[] = [
  {
    description:
      'Articles and categories built entirely on the Content Engine: drafts, revisions and scheduled publishing, signed preview links, multiple authors, cover images and a translation for every field. It ships the content types, the AdminCP screens and a public API. The public pages are yours to design, and the example plugin shows how.',
    highlights: [
      'Articles, categories and multiple authors',
      'Drafts, 20 revisions and scheduled publishing',
      'Signed preview links that expire',
      'Per-field translations with locale fallback',
      'Cover images through any storage adapter',
      'A public API for the pages you build',
    ],
    Icon: PenLine,
    name: 'Blog',
    pkg: '@vitnode/blog',
    screen: 'contentEditor',
    status: 'available',
  },
  {
    description:
      'A small plugin that exists to be read. It ships public pages with loaders and a searchable browse page, an AdminCP page with navigation, four content types including a localized one, a typed Hono API module and event listeners, all wired the way the docs describe. Copy it, rename it, ship it.',
    highlights: [
      'Public pages with loaders and a browse page with search',
      'A typed Hono API module and event listeners',
      'Four content types, including a localized one',
      'An AdminCP page and navigation entry',
    ],
    Icon: FlaskConical,
    name: 'Example',
    pkg: '@vitnode/example',
    screen: 'integrations',
    status: 'reference',
  },
]

const ANATOMY: { Icon: LucideIcon; text: string; title: string }[] = [
  {
    Icon: Route,
    text: 'Public and AdminCP URLs with loaders, metadata and breadcrumbs, code-split per page.',
    title: 'Pages and routes',
  },
  {
    Icon: Braces,
    text: 'Hono modules with Zod schemas. The fetcher infers the types, Swagger documents them.',
    title: 'Typed API',
  },
  {
    Icon: Database,
    text: 'Drizzle tables and migrations, or a Content Engine definition that generates them.',
    title: 'Data model',
  },
  {
    Icon: Languages,
    text: 'A locale file per language, merged with core and overridable by the host app.',
    title: 'Translations',
  },
  {
    Icon: LayoutDashboard,
    text: 'Navigation, screens and dashboard widgets that appear next to the built-in ones.',
    title: 'AdminCP screens',
  },
  {
    Icon: ShieldCheck,
    text: 'Granular staff permissions, enforced on the API and reflected in the UI.',
    title: 'Permissions',
  },
  {
    Icon: Radio,
    text: 'Typed domain events and listeners, so plugins react to each other without coupling.',
    title: 'Events',
  },
  {
    Icon: Clock,
    text: 'Cron jobs and queue tasks registered in the database and visible in the AdminCP.',
    title: 'Background work',
  },
]

const STATUS_LABEL: Record<OfficialPlugin['status'], string> = {
  available: 'Available in canary',
  reference: 'Reference plugin',
}

export const PluginsPage = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <div className="flex flex-col">
    <section
      aria-labelledby="plugins-title"
      className="relative overflow-hidden"
    >
      <div aria-hidden className="mk-grid absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="mk-anim-drift bg-primary/20 absolute top-0 left-1/2 -z-10 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
      />
      <div className="container mx-auto flex flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-24">
        <Eyebrow>Plugins</Eyebrow>
        <h1
          className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          id="plugins-title"
        >
          Features arrive as plugins. Even ours.
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed text-pretty sm:text-lg">
          VitNode core handles members, roles, content, real-time updates,
          search and the Admin Control Panel. Everything else, including the
          blog you publish today, is an installable package that keeps its
          pages, API, data, translations and admin screens together.
        </p>
        <MarketingActions
          className="justify-center"
          LinkComponent={LinkComponent}
        />
      </div>
    </section>

    <MarketingSection id="official" labelledBy="official-title">
      <SectionHeading
        eyebrow="Official plugins"
        id="official-title"
        title="One you can install. One you should read."
      >
        The blog ships today, and the example plugin is the friendliest way to
        learn how a plugin is put together.
      </SectionHeading>

      <div className="flex flex-col gap-16">
        {OFFICIAL_PLUGINS.map(
          (
            { description, highlights, Icon, name, pkg, screen, status },
            index,
          ) => (
            <article
              aria-labelledby={`plugin-${pkg}`}
              className="grid items-center gap-8 lg:grid-cols-2"
              key={pkg}
            >
              <div
                className={
                  index % 2 === 1
                    ? 'flex flex-col gap-5 lg:order-2'
                    : 'flex flex-col gap-5'
                }
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-2xl">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <h3
                    className="text-2xl font-semibold tracking-tight sm:text-3xl"
                    id={`plugin-${pkg}`}
                  >
                    {name}
                  </h3>
                  <span
                    className={
                      status === 'available'
                        ? 'rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs font-semibold'
                    }
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </div>
                <code className="bg-muted w-fit rounded-md px-2 py-1 font-mono text-xs">
                  {pkg}
                </code>
                <p className="text-muted-foreground text-base leading-relaxed text-pretty">
                  {description}
                </p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {highlights.map((item) => (
                    <li
                      className="bg-card rounded-xl border px-3 py-2 text-sm"
                      key={item}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
                {status === 'available' ? (
                  <TextLink
                    href="/docs/guides/blog"
                    LinkComponent={LinkComponent}
                  >
                    Set up the blog plugin
                  </TextLink>
                ) : null}
                {status === 'reference' ? (
                  <TextLink
                    href="/docs/guides/first-plugin"
                    LinkComponent={LinkComponent}
                  >
                    Build your first plugin
                  </TextLink>
                ) : null}
              </div>
              <ScreenFrame screen={SCREENS[screen]} />
            </article>
          ),
        )}
      </div>
    </MarketingSection>

    <div className="bg-muted/40 border-y">
      <MarketingSection id="anatomy" labelledBy="anatomy-title">
        <SectionHeading
          align="center"
          eyebrow="Anatomy of a plugin"
          id="anatomy-title"
          title="Everything a feature needs, in one package."
        >
          A plugin owns its slice of the product end to end. The host app owns
          composition and infrastructure. That boundary pays rent surprisingly
          quickly.
        </SectionHeading>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ANATOMY.map(({ Icon, text, title }) => (
            <li
              className="bg-card flex flex-col gap-3 rounded-2xl border p-5"
              key={title}
            >
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                <Icon aria-hidden className="size-4" />
              </span>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                {text}
              </p>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-center text-sm font-medium">
            Ideas people keep asking us about. Every one of them is a plugin
            waiting to happen.
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

    <MarketingSection labelledBy="plugins-cta-title">
      <div className="bg-card flex flex-col items-center gap-6 rounded-3xl border px-6 py-16 text-center">
        <h2
          className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl"
          id="plugins-cta-title"
        >
          Your feature is one package away.
        </h2>
        <p className="text-muted-foreground max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
          Run one command, get a plugin skeleton with a route, a locale and a
          config. The tutorial takes you from there to a working page in ten
          minutes.
        </p>
        <MarketingActions
          className="justify-center"
          LinkComponent={LinkComponent}
        />
        <TextLink href="/docs/dev/plugins/create" LinkComponent={LinkComponent}>
          Read the plugin guide
        </TextLink>
      </div>
      <CanaryNotice LinkComponent={LinkComponent} />
    </MarketingSection>
  </div>
)
