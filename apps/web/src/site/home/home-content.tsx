import { LogoVitNode } from '@vitnode/core/components/logo-vitnode'
import { buttonVariants } from '@vitnode/core/components/ui/button'
import { cn } from '@vitnode/core/lib/utils'
import {
  ArrowRight,
  Check,
  FileText,
  Globe2,
  Heart,
  LayoutDashboard,
  LockKeyhole,
  MessageCircle,
  Puzzle,
  Server,
  Sparkles,
  Users,
} from 'lucide-react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import adminControlPanel from '#/site/home/assets/admin-control-panel.png'
import maciej from '#/site/home/assets/maciej-avatar.png'
import { CommunityPreview, PluginDiagram } from '#/site/home/visuals'

const REPOSITORY = 'https://github.com/aXenDeveloper/vitnode'

const benefits = [
  {
    Icon: Heart,
    title: 'Make it feel like you.',
    description:
      'Give customers, members, or fans a home shaped around your brand and the way they connect.',
  },
  {
    Icon: LayoutDashboard,
    title: 'Give your team a head start.',
    description:
      'Start with accounts, content tools, and an admin panel. Put more effort into the experience people come for.',
  },
  {
    Icon: Server,
    title: 'Keep the keys.',
    description:
      'Run it on your infrastructure. Keep control of your data, your hosting, and what happens next.',
  },
]

const comparison = [
  {
    label: 'A hosted community platform',
    best: 'You want a managed service and a quicker launch.',
    tradeoff:
      'Your experience depends on the features, plans, and customization the provider offers.',
  },
  {
    label: 'A general app starter',
    best: 'You want a starting point for a fully custom product.',
    tradeoff:
      'Your team assembles the community tools and the workflows that connect them.',
  },
  {
    label: 'VitNode',
    best: 'You want a custom community with a shared foundation.',
    tradeoff:
      'You need a development team and your own hosting. Canary is still very early and will change.',
  },
]

export const HomeRouteContent = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <div className="home-page">
    <aside
      aria-label="Release status"
      className="border-b bg-primary/5 px-6 py-3 text-center text-sm leading-relaxed text-foreground"
    >
      <strong className="font-semibold">VitNode 2.0 Canary</strong>
      <span aria-hidden className="px-2">
        ·
      </span>
      Very early build. Expect rough edges and breaking changes.{' '}
      <a className="home-text-link whitespace-nowrap" href="#canary">
        Read before you start <span aria-hidden>↗</span>
      </a>
    </aside>

    <section aria-labelledby="home-title" className="home-hero home-wrap">
      <div className="flex max-w-4xl flex-col items-center gap-6 text-center">
        <p className="home-eyebrow">
          <span className="rounded-full border px-3 py-1">
            Open source. Open doors.
          </span>
        </p>
        <h1
          className="text-5xl leading-tight font-medium tracking-tight text-balance sm:text-6xl lg:text-7xl"
          id="home-title"
        >
          Your people.
          <br />
          <span className="text-primary">Your kind of place.</span>
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">
          The community framework for a space that feels like yours. Bring your
          people together, give your team a head start, and keep the keys.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <LinkComponent
            className={cn(buttonVariants({ size: 'lg' }), 'rounded-full px-6')}
            href="/docs/dev/setup"
          >
            Explore the canary <ArrowRight aria-hidden className="size-4" />
          </LinkComponent>
          <a
            className={cn(
              buttonVariants({ size: 'lg', variant: 'outline' }),
              'rounded-full bg-card px-6 text-card-foreground',
            )}
            href={REPOSITORY}
          >
            View on GitHub
          </a>
        </div>
        <p className="text-sm text-muted-foreground">
          MIT licensed · Self-hosted · A little early. A lot possible.
        </p>
      </div>
      <CommunityPreview />
    </section>

    <section
      aria-label="Why build with VitNode"
      className="home-wrap border-b py-12"
    >
      <div className="grid gap-8 md:grid-cols-3 md:gap-12">
        {benefits.map(({ Icon, title, description }) => (
          <div className="flex flex-col gap-3" key={title}>
            <Icon aria-hidden className="size-5 text-primary" />
            <h2 className="text-lg font-medium text-balance">{title}</h2>
            <p className="leading-relaxed text-pretty text-muted-foreground">
              {description}
            </p>
          </div>
        ))}
      </div>
    </section>

    <section
      aria-labelledby="features-title"
      className="home-wrap home-section"
      id="features"
    >
      <div className="flex max-w-2xl flex-col gap-4">
        <p className="home-eyebrow">Less setup. More belonging.</p>
        <h2 className="home-heading" id="features-title">
          Big community energy.
          <br />A smaller to-do list.
        </h2>
        <p className="home-description">
          The everyday essentials, working together. So your next great idea
          doesn’t begin with “first, let’s build another admin panel.”
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <article className="home-feature lg:col-span-7">
          <div className="home-feature-copy">
            <LayoutDashboard aria-hidden className="size-5 text-primary" />
            <h3>Your team’s happy place.</h3>
            <p>
              Manage members, content, and settings in one admin panel. Give
              staff the tools to get things done without a developer on speed
              dial.
            </p>
            <LinkComponent
              className="home-text-link"
              href="/docs/dev/plugins/admin"
            >
              Meet the admin panel <ArrowRight aria-hidden className="size-4" />
            </LinkComponent>
          </div>
          <figure className="flex flex-col gap-3 overflow-hidden px-6 pb-6">
            <img
              alt="VitNode Admin Control Panel with management navigation and its debug overview."
              className="w-full rounded-xl border shadow-sm"
              decoding="async"
              height={1392}
              loading="lazy"
              src={adminControlPanel}
              width={2880}
            />
            <figcaption className="text-sm text-muted-foreground">
              The real AdminCP. No dashboard cosplay.
            </figcaption>
          </figure>
        </article>
        <article className="home-feature lg:col-span-5">
          <div className="home-feature-copy">
            <Puzzle aria-hidden className="size-5 text-primary" />
            <h3>New ideas. Room to grow.</h3>
            <p>
              Add features as plugins, with their own pages and management
              tools. Start with the blog plugin or build something only your
              community needs.
            </p>
            <LinkComponent
              className="home-text-link"
              href="/docs/dev/plugins/create"
            >
              Explore plugins <ArrowRight aria-hidden className="size-4" />
            </LinkComponent>
          </div>
          <PluginDiagram />
        </article>
        <article className="home-feature lg:col-span-4">
          <div className="home-feature-copy">
            <FileText aria-hidden className="size-5 text-primary" />
            <h3>Good content. Less busywork.</h3>
            <p>
              Give editors a place to manage the content your team defines. The
              Content Engine creates the forms and lists behind it.
            </p>
            <LinkComponent
              className="home-text-link"
              href="/docs/dev/content-engine"
            >
              Explore content tools{' '}
              <ArrowRight aria-hidden className="size-4" />
            </LinkComponent>
          </div>
          <div aria-hidden className="home-miniature">
            <div className="flex items-center justify-between gap-3 border-b pb-3">
              <span className="font-medium">The community journal</span>
              <FileText className="size-4 text-primary" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>A very warm welcome</span>
              <span className="home-pill">Published</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>What’s next?</span>
              <span className="text-muted-foreground">Draft</span>
            </div>
          </div>
        </article>
        <article className="home-feature lg:col-span-4">
          <div className="home-feature-copy">
            <LockKeyhole aria-hidden className="size-5 text-primary" />
            <h3>The right keys. The right people.</h3>
            <p>
              Built-in accounts, member roles, and staff permissions help you
              decide who belongs where and who can manage what.
            </p>
            <LinkComponent
              className="home-text-link"
              href="/docs/dev/working-with-users/staff-permissions"
            >
              See staff permissions{' '}
              <ArrowRight aria-hidden className="size-4" />
            </LinkComponent>
          </div>
          <div aria-hidden className="home-miniature">
            <div className="flex items-center gap-3">
              <Users className="size-4 text-primary" />
              <span className="font-medium">Everyone has their place</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {['Members', 'Editors', 'Administrators'].map((role) => (
                <span className="rounded-lg border px-3 py-2" key={role}>
                  {role}
                </span>
              ))}
            </div>
          </div>
        </article>
        <article className="home-feature lg:col-span-4">
          <div className="home-feature-copy">
            <Globe2 aria-hidden className="size-5 text-primary" />
            <h3>Make “welcome” travel.</h3>
            <p>
              Reach people in their language. Translation tools and
              language-aware pages give your team a foundation for a
              multilingual community.
            </p>
            <LinkComponent className="home-text-link" href="/docs/dev/i18n">
              Explore languages <ArrowRight aria-hidden className="size-4" />
            </LinkComponent>
          </div>
          <div aria-hidden className="home-miniature">
            <div className="flex items-center gap-3">
              <Globe2 className="size-4 text-primary" />
              <span className="font-medium">A warm welcome, everywhere.</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="home-pill" lang="en">
                Hello
              </span>
              <span className="home-pill" lang="pl">
                Cześć
              </span>
              <span className="home-pill" lang="es">
                Hola
              </span>
              <span className="home-pill" lang="fr">
                Bonjour
              </span>
            </div>
          </div>
        </article>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Built on React, TanStack Start, Hono, and PostgreSQL.{' '}
        <LinkComponent className="home-text-link" href="/docs/dev/architecture">
          For the curious developers →
        </LinkComponent>
      </p>
    </section>

    <section
      aria-labelledby="compare-title"
      className="border-y bg-muted/40 text-foreground"
      id="compare"
    >
      <div className="home-wrap home-section">
        <div className="flex max-w-2xl flex-col gap-4">
          <p className="home-eyebrow">Find your fit</p>
          <h2 className="home-heading" id="compare-title">
            Your community.
            <br />A few ways to get there.
          </h2>
          <p className="home-description">
            Different teams need different starting points. Here’s where VitNode
            fits, minus the suspicious wall of green checkmarks.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {comparison.map(({ label, best, tradeoff }, index) => (
            <article
              className={cn(
                'flex flex-col gap-6 rounded-2xl border bg-card p-6 text-card-foreground md:p-8',
                index === 2 && 'border-primary ring-1 ring-primary',
              )}
              key={label}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">{label}</h3>
                {index === 2 && <span className="home-pill">That’s us</span>}
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-primary">
                  A good fit when
                </p>
                <p className="leading-relaxed text-pretty">{best}</p>
              </div>
              <div className="flex flex-col gap-2 border-t pt-5">
                <p className="text-sm font-medium">The trade-off</p>
                <p className="leading-relaxed text-pretty text-muted-foreground">
                  {tradeoff}
                </p>
              </div>
            </article>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A comparison of approaches, not individual products. Features and
          costs vary. VitNode’s code is MIT licensed; hosting, development, and
          maintenance are yours to plan for.
        </p>
      </div>
    </section>

    <section
      aria-labelledby="maker-title"
      className="home-wrap home-section"
      id="maker"
    >
      <div className="grid items-center gap-10 md:grid-cols-5 md:gap-16">
        <div className="flex flex-col items-start gap-5 md:col-span-2">
          <img
            alt="Maciej Balcerzak’s GitHub avatar"
            className="size-40 rounded-3xl border object-cover sm:size-52"
            decoding="async"
            height={256}
            loading="lazy"
            src={maciej}
            width={256}
          />
          <div className="flex flex-col gap-1">
            <p className="text-lg font-medium">Maciej Balcerzak</p>
            <p className="text-sm text-muted-foreground">
              Creator of VitNode · aXenDeveloper
            </p>
          </div>
          <a className="home-text-link" href="https://github.com/aXenDeveloper">
            Find me on GitHub <ArrowRight aria-hidden className="size-4" />
          </a>
        </div>
        <div className="flex flex-col gap-6 md:col-span-3">
          <p className="home-eyebrow">A human behind the framework</p>
          <h2 className="home-heading" id="maker-title">
            Hi, I’m Maciej.
            <br />
            Yes, an actual person.
          </h2>
          <p className="home-description">
            I’m building VitNode for people who want a community that feels like
            their own. The kind where the software makes room for your ideas.
          </p>
          <p className="home-description">
            The goal is simple: give teams a useful foundation, keep it open,
            and make the next feature less of a mountain. It’s early, and
            there’s plenty to figure out. That’s why I’m building it in public.
          </p>
          <p className="text-lg font-medium text-pretty">
            Try it. Break it a little. Tell me what would make it better.
          </p>
          <a className="home-text-link" href={`${REPOSITORY}/issues`}>
            Help shape VitNode <MessageCircle aria-hidden className="size-4" />
          </a>
        </div>
      </div>
    </section>

    <section
      aria-labelledby="canary-title"
      className="home-wrap pb-16 md:pb-24"
      id="canary"
    >
      <div className="grid gap-8 rounded-3xl border bg-card p-6 text-card-foreground md:grid-cols-2 md:p-10">
        <div className="flex flex-col gap-4">
          <p className="home-eyebrow">
            <Sparkles aria-hidden className="size-4" /> The small print, in
            normal-sized print
          </p>
          <h2
            className="text-3xl font-medium tracking-tight text-balance"
            id="canary-title"
          >
            Canary. Still finding its wings.
          </h2>
          <p className="home-description">
            VitNode 2.0 is a very early build, not a stable release. Features
            and APIs can change, things can break, and upgrades may need manual
            work.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-4">
          <p className="flex items-start gap-3 leading-relaxed">
            <Check aria-hidden className="size-5 shrink-0 text-primary" />A good
            place to experiment, build a prototype, and help shape the
            framework.
          </p>
          <p className="flex items-start gap-3 leading-relaxed">
            <LockKeyhole aria-hidden className="size-5 shrink-0 text-primary" />
            Not ready to be relied on for a business-critical community.
          </p>
          <a className="home-text-link" href={`${REPOSITORY}/releases`}>
            Follow release updates <ArrowRight aria-hidden className="size-4" />
          </a>
        </div>
      </div>
    </section>

    <section aria-labelledby="start-title" className="home-closing border-t">
      <div className="home-wrap flex flex-col items-center gap-6 py-20 text-center md:py-28">
        <LogoVitNode
          aria-hidden
          className="size-12"
          idPrefix="home-closing"
          small
        />
        <h2 className="home-heading" id="start-title">
          Bring your people.
          <br />
          We’ll bring the starting point.
        </h2>
        <p className="home-description max-w-lg">
          Your next community starts with an idea. Take the canary for a spin
          and help decide what comes next.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <LinkComponent
            className={cn(buttonVariants({ size: 'lg' }), 'rounded-full px-6')}
            href="/docs/dev/setup"
          >
            Get started with canary{' '}
            <ArrowRight aria-hidden className="size-4" />
          </LinkComponent>
          <a
            className={cn(
              buttonVariants({ size: 'lg', variant: 'outline' }),
              'rounded-full bg-card px-6 text-card-foreground',
            )}
            href={REPOSITORY}
          >
            Explore the source
          </a>
        </div>
      </div>
    </section>
  </div>
)
