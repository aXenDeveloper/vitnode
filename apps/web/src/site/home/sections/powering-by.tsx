import { InfiniteSlider } from '#/site/home/infinite-slider'
import { DrizzleORMLogo } from '#/site/home/sections/logos/drizzleorm'
import { HonoJSLogo } from '#/site/home/sections/logos/honojs'
import { PostgreSQLLogo } from '#/site/home/sections/logos/postgresql'
import { TailwindCSSLogo } from '#/site/home/sections/logos/tailwindcss'
import { TanStackLogo } from '#/site/home/sections/logos/tanstack'
import { TurboRepoLogo } from '#/site/home/sections/logos/turborepo'

/** One entry in the marquee: where it points, and the mark that points there. */
const TOOLS = [
  { href: 'https://tailwindcss.com/', logo: <TailwindCSSLogo /> },
  { href: 'https://tanstack.com/', logo: <TanStackLogo /> },
  { href: 'https://hono.dev/', logo: <HonoJSLogo /> },
  { href: 'https://turborepo.com/', logo: <TurboRepoLogo /> },
  { href: 'https://orm.drizzle.team/', logo: <DrizzleORMLogo /> },
  { href: 'https://www.postgresql.org/', logo: <PostgreSQLLogo /> },
]

export const PoweringBySection = () => (
  <section className="bg-background border-border/75 dark:border-border/50 overflow-hidden border">
    <div className="group relative m-auto max-w-7xl px-6">
      <div className="flex flex-col items-center md:flex-row">
        <div className="md:max-w-44 md:border-r md:pr-6">
          <h2 className="text-end text-sm">Powering by the best tools</h2>
        </div>

        <div className="relative py-6 md:w-[calc(100%-11rem)]">
          <InfiniteSlider gap={100} speed={40} speedOnHover={20}>
            {TOOLS.map(({ href, logo }) => (
              <a
                className="flex items-center justify-center gap-2"
                href={href}
                key={href}
                rel="noopener noreferrer"
                target="_blank"
              >
                {logo}
              </a>
            ))}
          </InfiniteSlider>

          <div className="from-background absolute inset-y-0 left-0 w-20 bg-linear-to-r" />
          <div className="from-background absolute inset-y-0 right-0 w-20 bg-linear-to-l" />
        </div>
      </div>
    </div>
  </section>
)
