import { InfiniteSlider } from '@/site/home/infinite-slider'
import { DrizzleORMLogo } from '@/site/home/sections/logos/drizzleorm'
import { HonoJSLogo } from '@/site/home/sections/logos/honojs'
import { PostgreSQLLogo } from '@/site/home/sections/logos/postgresql'
import { TailwindCSSLogo } from '@/site/home/sections/logos/tailwindcss'
import { TanStackLogo } from '@/site/home/sections/logos/tanstack'
import { TurboRepoLogo } from '@/site/home/sections/logos/turborepo'

const TOOLS = [
  { href: 'https://tailwindcss.com/', logo: <TailwindCSSLogo /> },
  { href: 'https://tanstack.com/', logo: <TanStackLogo /> },
  { href: 'https://hono.dev/', logo: <HonoJSLogo /> },
  { href: 'https://turborepo.com/', logo: <TurboRepoLogo /> },
  { href: 'https://orm.drizzle.team/', logo: <DrizzleORMLogo /> },
  { href: 'https://www.postgresql.org/', logo: <PostgreSQLLogo /> },
]

export const PoweringBySection = () => (
  <section
    aria-label="Technologies VitNode is built on"
    className="overflow-hidden"
  >
    <div className="container mx-auto flex flex-col items-center gap-6 px-4 py-10 sm:px-6">
      <p className="text-muted-foreground font-mono text-xs font-medium tracking-wider uppercase">
        Built on tools your team already trusts
      </p>

      <div className="relative w-full min-w-0">
        <InfiniteSlider gap={100} speed={40} speedOnHover={20}>
          {TOOLS.map(({ href, logo }) => (
            <a
              className="flex items-center justify-center gap-2 opacity-60 transition-opacity hover:opacity-100"
              href={href}
              key={href}
              rel="noopener noreferrer"
              target="_blank"
            >
              {logo}
            </a>
          ))}
        </InfiniteSlider>

        <div className="from-background pointer-events-none absolute inset-y-0 left-0 w-24 bg-linear-to-r" />
        <div className="from-background pointer-events-none absolute inset-y-0 right-0 w-24 bg-linear-to-l" />
      </div>
    </div>
  </section>
)
