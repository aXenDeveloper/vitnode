import type { LucideIcon } from 'lucide-react'

import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import {
  ArrowUpRight,
  HardDrive,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import { INTEGRATION_MARKS } from '@/site/home/sections/logos/integration-marks'
import { MarketingSection, SectionHeading } from '@/site/marketing/shared'

type Destination = { docs: string } | { href: string }

type Integration = Destination & {
  blurb?: string
  category?: string
  color: string
  featured?: boolean
  glyph?: LucideIcon
  highlighted?: boolean
  mark?: string
  name: string
  short?: string
}

const FOREGROUND = 'var(--foreground)'

const INTEGRATIONS: Integration[] = [
  {
    blurb: 'Full-stack React with type-safe routing and SSR.',
    category: 'Front end',
    color: FOREGROUND,
    highlighted: true,
    href: 'https://tanstack.com/start',
    mark: INTEGRATION_MARKS.tanstack,
    name: 'TanStack Start',
  },
  {
    blurb: 'A fast, typed API with OpenAPI docs served at /api/swagger.',
    category: 'API',
    color: '#e36002',
    highlighted: true,
    href: 'https://hono.dev/',
    mark: INTEGRATION_MARKS.hono,
    name: 'Hono',
  },
  {
    color: '#0e9f6e',
    docs: 'dev/email/nodemailer',
    glyph: Mail,
    name: 'Nodemailer',
  },
  {
    color: '#ec7211',
    docs: 'dev/storage/s3-r2',
    glyph: HardDrive,
    name: 'S3-compatible storage',
    short: 'S3 / R2',
  },
  {
    color: '#00bfb3',
    docs: 'dev/search-elasticsearch',
    mark: INTEGRATION_MARKS.elasticsearch,
    name: 'Elasticsearch',
  },
  {
    blurb: 'Full-text search out of the box, tuned per language.',
    category: 'Search',
    color: '#4169e1',
    docs: 'dev/search',
    featured: true,
    mark: INTEGRATION_MARKS.postgresql,
    name: 'PostgreSQL',
  },
  {
    color: '#06b6d4',
    href: 'https://tailwindcss.com/',
    mark: INTEGRATION_MARKS.tailwindcss,
    name: 'Tailwind CSS',
  },
  {
    color: '#84a816',
    href: 'https://orm.drizzle.team/',
    mark: INTEGRATION_MARKS.drizzle,
    name: 'Drizzle ORM',
    short: 'Drizzle',
  },
  {
    color: '#f38020',
    docs: 'dev/captcha/cloudflare',
    mark: INTEGRATION_MARKS.cloudflare,
    name: 'Cloudflare Turnstile',
    short: 'Turnstile',
  },
  {
    color: '#4285f4',
    docs: 'dev/captcha/recaptcha',
    glyph: ShieldCheck,
    name: 'Google reCAPTCHA',
    short: 'reCAPTCHA',
  },
  {
    color: FOREGROUND,
    docs: 'dev/ai',
    glyph: Sparkles,
    name: 'AI SDK',
  },
  {
    color: '#2496ed',
    docs: 'dev/deployments/self-hosted',
    mark: INTEGRATION_MARKS.docker,
    name: 'Docker',
  },
  {
    color: '#5fa04e',
    docs: 'dev/cron/node-cron',
    mark: INTEGRATION_MARKS.nodejs,
    name: 'node-cron',
  },
]

const HIGHLIGHTED = INTEGRATIONS.filter(({ highlighted }) => highlighted)
const MOSAIC = INTEGRATIONS.filter(({ highlighted }) => !highlighted)

const brandStyle = (color: string) =>
  ({ '--brand': color }) as React.CSSProperties

const IntegrationMark = ({
  className,
  integration,
}: {
  className?: string
  integration: Integration
}) => {
  const Glyph = integration.glyph

  if (Glyph) return <Glyph aria-hidden className={className} />

  return (
    <svg
      aria-hidden
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={integration.mark} />
    </svg>
  )
}

const IntegrationLink = ({
  children,
  className,
  integration,
}: {
  children: React.ReactNode
  className: string
  integration: Integration
}) => {
  if ('href' in integration)
    return (
      <a
        aria-label={`${integration.name} website (opens in a new tab)`}
        className={className}
        href={integration.href}
        rel="noopener noreferrer"
        style={brandStyle(integration.color)}
        target="_blank"
      >
        {children}
      </a>
    )

  return (
    <Link
      aria-label={
        integration.featured ? undefined : `${integration.name} setup guide`
      }
      className={className}
      params={{ _splat: integration.docs }}
      style={brandStyle(integration.color)}
      to="/docs/$"
    >
      {children}
    </Link>
  )
}

const CARD =
  'group focus-visible:outline-ring flex w-full rounded-3xl bg-(--brand)/8 transition-[background-color,scale] duration-200 ease-out hover:bg-(--brand)/12 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98]'

const CardArrow = ({ className }: { className?: string }) => (
  <ArrowUpRight
    aria-hidden
    className={cn(
      'text-muted-foreground size-5 shrink-0 transition-[color,translate] duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-(--brand)',
      className,
    )}
  />
)

const CardMark = ({ integration }: { integration: Integration }) => (
  <span className="bg-card flex size-12 shrink-0 items-center justify-center rounded-2xl text-(--brand) shadow-sm lg:size-14">
    <IntegrationMark className="size-7 lg:size-8" integration={integration} />
  </span>
)

const HighlightCard = ({ integration }: { integration: Integration }) => (
  <IntegrationLink
    className={cn(CARD, 'items-center gap-4 rounded-2xl p-4 sm:p-5')}
    integration={integration}
  >
    <CardMark integration={integration} />
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-base font-semibold tracking-tight">
          {integration.name}
        </span>
        <span className="text-muted-foreground text-xs font-medium">
          {integration.category}
        </span>
      </span>
      <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {integration.blurb}
      </span>
    </span>
    <CardArrow className="self-start" />
  </IntegrationLink>
)

const FeaturedCard = ({ integration }: { integration: Integration }) => (
  <IntegrationLink
    className={cn(
      CARD,
      'flex-col justify-between gap-6 p-6 max-lg:flex-row max-lg:items-center max-lg:justify-start max-lg:gap-4 max-lg:rounded-2xl max-lg:p-4',
    )}
    integration={integration}
  >
    <span className="flex shrink-0 items-start justify-between gap-4">
      <CardMark integration={integration} />
      <CardArrow className="max-lg:hidden" />
    </span>
    <span className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs font-medium max-lg:hidden">
        {integration.category}
      </span>
      <span className="text-xl font-semibold tracking-tight max-lg:text-base">
        {integration.name}
      </span>
      <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {integration.blurb}
      </span>
    </span>
  </IntegrationLink>
)

const IntegrationTile = ({ integration }: { integration: Integration }) => (
  <IntegrationLink
    className="mk-integration-tile flex w-full flex-col items-center justify-center gap-2 rounded-2xl p-4"
    integration={integration}
  >
    <IntegrationMark
      className="mk-integration-mark size-8"
      integration={integration}
    />
    <span className="text-muted-foreground text-center text-xs font-medium text-balance">
      {integration.short ?? integration.name}
    </span>
  </IntegrationLink>
)

export const IntegrationsSection = () => (
  <MarketingSection id="integrations" labelledBy="integrations-title">
    <SectionHeading
      align="center"
      eyebrow="Integrations"
      id="integrations-title"
      title="Plays nicely with the tools you already use."
    >
      Built on TanStack Start, Hono, Drizzle and Tailwind CSS, with adapters for
      email, storage, search, captcha and AI. Every tile links to its guide or
      homepage.
    </SectionHeading>

    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
      <ul className="grid gap-3 sm:grid-cols-2">
        {HIGHLIGHTED.map((integration) => (
          <li className="flex" key={integration.name}>
            <HighlightCard integration={integration} />
          </li>
        ))}
      </ul>

      <ul className="grid grid-flow-dense grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {MOSAIC.map((integration) => (
          <li
            className={cn(
              'flex',
              integration.featured && 'col-span-2 lg:row-span-2',
            )}
            key={integration.name}
          >
            {integration.featured ? (
              <FeaturedCard integration={integration} />
            ) : (
              <IntegrationTile integration={integration} />
            )}
          </li>
        ))}
      </ul>
    </div>
  </MarketingSection>
)
