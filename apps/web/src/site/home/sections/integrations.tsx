import { Link } from '@tanstack/react-router'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@vitnode/core/components/ui/tooltip'

import {
  AmazonS3Mark,
  NodemailerMark,
  PostgreSQLElephant,
  ReCaptchaMark,
} from '@/site/home/sections/logos/integration-logos'
import { INTEGRATION_MARKS } from '@/site/home/sections/logos/integration-marks'
import {
  MarketingSection,
  SectionHeading,
  TextLink,
} from '@/site/marketing/shared'

type Destination = { docs: string } | { href: string }

type Logo =
  | { logo: React.ElementType<{ className: string }> }
  | { mark: string }

type Integration = Destination &
  Logo & {
    color: string
    name: string
    role: string
  }

const FOREGROUND = 'var(--foreground)'

const TANSTACK_START: Integration = {
  color: FOREGROUND,
  href: 'https://tanstack.com/start',
  mark: INTEGRATION_MARKS.tanstack,
  name: 'TanStack Start',
  role: 'Front end',
}

const HONO: Integration = {
  color: '#e36002',
  href: 'https://hono.dev/',
  mark: INTEGRATION_MARKS.hono,
  name: 'Hono',
  role: 'API',
}

const REACT: Integration = {
  color: '#149eca',
  href: 'https://react.dev/',
  mark: INTEGRATION_MARKS.react,
  name: 'React',
  role: 'UI',
}

const DRIZZLE: Integration = {
  color: '#84a816',
  href: 'https://orm.drizzle.team/',
  mark: INTEGRATION_MARKS.drizzle,
  name: 'Drizzle',
  role: 'ORM',
}

const POSTGRESQL: Integration = {
  color: '#4169e1',
  docs: 'dev/search',
  logo: PostgreSQLElephant,
  name: 'PostgreSQL',
  role: 'Database and search',
}

const TAILWIND: Integration = {
  color: '#06b6d4',
  href: 'https://tailwindcss.com/',
  mark: INTEGRATION_MARKS.tailwindcss,
  name: 'Tailwind CSS',
  role: 'Styling',
}

const NODEMAILER: Integration = {
  color: '#22b573',
  docs: 'dev/email/nodemailer',
  logo: NodemailerMark,
  name: 'Nodemailer',
  role: 'Email',
}

const S3: Integration = {
  color: '#e25444',
  docs: 'dev/storage/s3-r2',
  logo: AmazonS3Mark,
  name: 'S3 / R2',
  role: 'Storage',
}

const ELASTICSEARCH: Integration = {
  color: '#00bfb3',
  docs: 'dev/search-elasticsearch',
  mark: INTEGRATION_MARKS.elasticsearch,
  name: 'Elasticsearch',
  role: 'Search',
}

const AI_SDK: Integration = {
  color: FOREGROUND,
  docs: 'dev/ai',
  mark: INTEGRATION_MARKS.vercel,
  name: 'AI SDK',
  role: 'AI models',
}

const TURNSTILE: Integration = {
  color: '#f38020',
  docs: 'dev/captcha/cloudflare',
  mark: INTEGRATION_MARKS.cloudflare,
  name: 'Cloudflare Turnstile',
  role: 'Captcha',
}

const RECAPTCHA: Integration = {
  color: '#4285f4',
  docs: 'dev/captcha/recaptcha',
  logo: ReCaptchaMark,
  name: 'Google reCAPTCHA',
  role: 'Captcha',
}

const NODE_CRON: Integration = {
  color: '#5fa04e',
  docs: 'dev/cron/node-cron',
  mark: INTEGRATION_MARKS.nodejs,
  name: 'node-cron',
  role: 'Cron',
}

const DOCKER: Integration = {
  color: '#2496ed',
  docs: 'dev/deployments/self-hosted',
  mark: INTEGRATION_MARKS.docker,
  name: 'Docker',
  role: 'Deploy',
}

const WIDE_COLUMNS: Integration[][] = [
  [DOCKER],
  [NODEMAILER, TAILWIND],
  [REACT, TANSTACK_START, S3],
  [HONO, DRIZZLE],
  [ELASTICSEARCH, POSTGRESQL, TURNSTILE],
  [AI_SDK, RECAPTCHA],
  [NODE_CRON],
]

const COMPACT_COLUMNS: Integration[][] = [
  [NODEMAILER, TAILWIND],
  [REACT, TANSTACK_START, S3],
  [DOCKER, HONO, DRIZZLE, NODE_CRON],
  [ELASTICSEARCH, POSTGRESQL, TURNSTILE],
  [AI_SDK, RECAPTCHA],
]

const TILE = 'mk-integration-tile touch-manipulation'

type Point = readonly [number, number]

const HEX_RADIUS = 50
const HEX_HEIGHT = HEX_RADIUS * Math.sqrt(3)
const HEX_VIEW_BOX = `${-HEX_RADIUS} ${-HEX_HEIGHT / 2} ${HEX_RADIUS * 2} ${HEX_HEIGHT}`

const towards = ([x, y]: Point, [toX, toY]: Point, distance: number) => {
  const length = Math.hypot(toX - x, toY - y)

  return `${(x + ((toX - x) / length) * distance).toFixed(2)} ${(y + ((toY - y) / length) * distance).toFixed(2)}`
}

const roundedHexagonPath = (radius: number, cornerRadius: number) => {
  const points = Array.from({ length: 6 }, (_, index): Point => {
    const angle = (Math.PI / 3) * index

    return [radius * Math.cos(angle), radius * Math.sin(angle)]
  })

  return `${points
    .map((point, index) => {
      const previous = points[(index + points.length - 1) % points.length]
      const next = points[(index + 1) % points.length]

      return `${index === 0 ? 'M' : 'L'}${towards(point, previous, cornerRadius)}Q${point[0].toFixed(2)} ${point[1].toFixed(2)} ${towards(point, next, cornerRadius)}`
    })
    .join('')}Z`
}

const HEX_PATH = roundedHexagonPath(HEX_RADIUS, 10)

const Hexagon = ({ className }: { className: string }) => (
  <svg
    aria-hidden
    className={className}
    viewBox={HEX_VIEW_BOX}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d={HEX_PATH} vectorEffect="non-scaling-stroke" />
  </svg>
)

const TileFace = ({ integration }: { integration: Integration }) => (
  <>
    <Hexagon className="mk-integration-hit size-full" />
    <span className="mk-integration-face text-(--brand)">
      <Hexagon className="mk-integration-outline size-full overflow-visible" />
      <IntegrationMark integration={integration} />
    </span>
  </>
)

const IntegrationMark = ({ integration }: { integration: Integration }) => {
  const className = 'mk-integration-mark sm:size-8 lg:size-11'

  if ('logo' in integration) return <integration.logo className={className} />

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
  integration,
  ...props
}: Omit<React.ComponentProps<'a'>, 'href'> & {
  integration: Integration
}) => {
  const label = `${integration.name}, ${integration.role}`
  const style = { '--brand': integration.color } as React.CSSProperties

  if ('href' in integration)
    return (
      <a
        {...props}
        aria-label={`${label} (opens in a new tab)`}
        className={TILE}
        href={integration.href}
        rel="noopener noreferrer"
        style={style}
        target="_blank"
      >
        <TileFace integration={integration} />
      </a>
    )

  return (
    <Link
      {...props}
      aria-label={label}
      className={TILE}
      params={{ _splat: integration.docs }}
      style={style}
      to="/docs/$"
    >
      <TileFace integration={integration} />
    </Link>
  )
}

const IntegrationTile = ({ integration }: { integration: Integration }) => (
  <Tooltip>
    <TooltipTrigger render={<IntegrationLink integration={integration} />} />
    <TooltipContent sideOffset={10}>
      <span className="font-medium">{integration.name}</span>
      <span className="opacity-70">{integration.role}</span>
    </TooltipContent>
  </Tooltip>
)

const IntegrationComb = ({
  columns,
  layout,
}: {
  columns: Integration[][]
  layout: 'compact' | 'wide'
}) => (
  <div
    aria-label="Tools VitNode is built on and integrates with"
    className="mk-integration-comb"
    data-layout={layout}
    role="list"
  >
    {columns.map((column) => (
      <div className="mk-integration-column" key={column[0].name}>
        {column.map((integration) => (
          <div key={integration.name} role="listitem">
            <IntegrationTile integration={integration} />
          </div>
        ))}
      </div>
    ))}
  </div>
)

export const IntegrationsSection = () => (
  <MarketingSection
    className="items-center gap-12 text-center"
    id="integrations"
    labelledBy="integrations-title"
  >
    <SectionHeading
      align="center"
      eyebrow="Integrations"
      id="integrations-title"
      title="Made of parts you already know."
    />

    <TooltipProvider delay={200}>
      <IntegrationComb columns={COMPACT_COLUMNS} layout="compact" />
      <IntegrationComb columns={WIDE_COLUMNS} layout="wide" />
    </TooltipProvider>

    <div className="flex flex-col items-center gap-4">
      <p className="text-muted-foreground font-book max-w-xl text-lg leading-relaxed text-pretty">
        The four in the middle are the core: TanStack Start renders the pages,
        Hono serves the API and Drizzle talks to PostgreSQL. Everything around
        them is an adapter you pick in config.
      </p>
      <TextLink params={{ _splat: 'dev' }} to="/docs/$">
        Explore the docs
      </TextLink>
    </div>
  </MarketingSection>
)
