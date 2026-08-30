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

/**
 * What VitNode is built on, as a row that scrolls.
 *
 * The list is the section's only real content, and this stage changed two
 * entries in it because they had stopped being true of the page they appear on.
 *
 * **Next.js is out.** It was the second mark in the row, and after this stage
 * the application rendering this row is TanStack Start. Next.js still serves
 * `/docs/*` until Stage 16 and still scaffolds a generated app, so it has not
 * left VitNode - but a row headed "Powering by the best tools" on the front page
 * of a TanStack Start site reads as a claim about *this* runtime, and that claim
 * was false. TanStack takes its place.
 *
 * **next-intl is out**, for the narrower version of the same reason: this
 * application reaches for `use-intl` directly and never for next-intl - which
 * `src/tests/isolation.test.ts` enforces - so its logotype was naming a package
 * the site does not run. `use-intl` has no mark of its own, and inventing one to
 * keep the count at seven would be worse than six honest entries.
 *
 * Everything else is the section as it was: same frame, same fades at both
 * edges, same speeds, same marks.
 *
 * Plain `<a>` rather than the migration link, because every href here leaves
 * VitNode entirely. `MigrationLink` answers "which of our two applications
 * serves this path", and for `https://hono.dev` the answer is neither.
 */
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
