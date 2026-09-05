import { buttonVariants } from '@vitnode/core/components/ui/button'
import { cn } from '@vitnode/core/lib/utils'
import { ArrowRight, Bird } from 'lucide-react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import { REPOSITORY_URL } from './links'

export const GitHubIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden
    className={cn('size-4', className)}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
      fill="currentColor"
    />
  </svg>
)

export const Eyebrow = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => (
  <p
    className={cn(
      'text-primary text-sm font-semibold tracking-wide uppercase',
      className,
    )}
  >
    {children}
  </p>
)

export const SectionHeading = ({
  align = 'start',
  children,
  eyebrow,
  id,
  title,
}: {
  align?: 'center' | 'start'
  children?: React.ReactNode
  eyebrow: string
  id: string
  title: string
}) => (
  <div
    className={cn(
      'flex max-w-2xl flex-col gap-4',
      align === 'center' && 'mx-auto items-center text-center',
    )}
  >
    <Eyebrow>{eyebrow}</Eyebrow>
    <h2
      className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl"
      id={id}
    >
      {title}
    </h2>
    {children ? (
      <p className="text-muted-foreground text-base leading-relaxed text-pretty sm:text-lg">
        {children}
      </p>
    ) : null}
  </div>
)

export const MarketingSection = ({
  children,
  className,
  id,
  labelledBy,
}: {
  children: React.ReactNode
  className?: string
  id?: string
  labelledBy: string
}) => (
  <section
    aria-labelledby={labelledBy}
    className={cn(
      'mk-section-anchor container mx-auto flex flex-col gap-12 px-4 py-16 sm:px-6 sm:py-24',
      className,
    )}
    id={id}
  >
    {children}
  </section>
)

export const TextLink = ({
  children,
  className,
  href,
  LinkComponent,
}: {
  children: React.ReactNode
  className?: string
  href: string
  LinkComponent: SiteLinkComponent
}) => (
  <LinkComponent
    className={cn(
      'group text-primary inline-flex w-fit items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline',
      className,
    )}
    href={href}
  >
    {children}
    <ArrowRight
      aria-hidden
      className="size-4 transition-transform group-hover:translate-x-0.5"
    />
  </LinkComponent>
)

export const MarketingActions = ({
  className,
  LinkComponent,
}: {
  className?: string
  LinkComponent: SiteLinkComponent
}) => (
  <div className={cn('flex flex-wrap items-center gap-3', className)}>
    <LinkComponent
      className={cn(buttonVariants({ size: 'lg' }), 'px-5')}
      href="/docs/dev/setup"
    >
      Start building free
      <ArrowRight aria-hidden />
    </LinkComponent>

    <a
      className={cn(buttonVariants({ size: 'lg', variant: 'outline' }), 'px-5')}
      href={REPOSITORY_URL}
      rel="noopener noreferrer"
      target="_blank"
    >
      <GitHubIcon />
      Star on GitHub
    </a>
  </div>
)

export const CanaryPill = ({ className }: { className?: string }) => (
  <span
    className={cn(
      'bg-primary/10 text-primary inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
      className,
    )}
  >
    <span aria-hidden className="relative flex size-2">
      <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-75" />
      <span className="bg-primary relative inline-flex size-2 rounded-full" />
    </span>
    VitNode 2.0 · Canary · very early build
  </span>
)

export const CanaryNotice = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <aside
    aria-label="Canary release status"
    className="bg-card flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6"
  >
    <span className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
      <Bird aria-hidden className="mk-anim-float size-6" />
    </span>

    <div className="flex flex-1 flex-col gap-1">
      <p className="font-semibold">
        Very early. Very canary. Still a bit fluffy.
      </p>
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        VitNode 2.0 is an early development build. Expect bugs, unfinished
        corners and breaking changes between releases. Perfect for exploring and
        prototyping. Not yet the place for your production community.
      </p>
    </div>

    <TextLink
      className="shrink-0"
      href="/docs/dev/contribution"
      LinkComponent={LinkComponent}
    >
      Help it grow up
    </TextLink>
  </aside>
)
