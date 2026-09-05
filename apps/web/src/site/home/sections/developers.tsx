import type { SiteLinkComponent } from '#/site/home/site-link'

import {
  MarketingSection,
  SectionHeading,
  TextLink,
} from '#/site/marketing/shared'

const STACK = [
  'TypeScript',
  'React 19',
  'TanStack Start',
  'Hono',
  'PostgreSQL',
  'Drizzle ORM',
  'Tailwind CSS',
]

const COMMANDS = [
  {
    comment: 'scaffold an app, choose Turborepo for plugins',
    line: 'pnpm create vitnode-app@canary',
  },
  {
    comment: 'start Postgres and run',
    line: 'pnpm docker:dev && pnpm dev',
  },
  {
    comment: 'your first feature gets its own package',
    line: 'pnpm create vitnode-app@canary --plugin',
  },
]

export const DevelopersSection = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <MarketingSection id="developers" labelledBy="developers-title">
    <div className="grid items-center gap-12 lg:grid-cols-2">
      <div className="flex flex-col gap-8">
        <SectionHeading
          eyebrow="A little something for the builders"
          id="developers-title"
          title="Less setup déjà vu."
        >
          Start a project, build a plugin, make it yours. Familiar tools
          underneath, end-to-end types in between, and more of your actual
          product on top.
        </SectionHeading>

        <ul className="flex flex-wrap gap-2">
          {STACK.map((item) => (
            <li
              className="bg-card rounded-full border px-3 py-1 text-xs font-semibold"
              key={item}
            >
              {item}
            </li>
          ))}
        </ul>

        <TextLink
          href="/docs/guides/first-plugin"
          LinkComponent={LinkComponent}
        >
          Build your first plugin in ten minutes
        </TextLink>
      </div>

      <div className="bg-card overflow-hidden rounded-3xl border shadow-lg">
        <div className="bg-muted/60 flex items-center gap-2 border-b px-4 py-3">
          <span aria-hidden className="flex gap-1.5">
            <span className="size-3 rounded-full bg-red-400/80" />
            <span className="size-3 rounded-full bg-amber-400/80" />
            <span className="size-3 rounded-full bg-emerald-400/80" />
          </span>
          <span className="text-muted-foreground mx-auto font-mono text-xs">
            terminal
          </span>
        </div>
        <pre className="overflow-x-auto p-6 font-mono text-sm leading-relaxed">
          <code className="flex flex-col gap-4">
            {COMMANDS.map(({ comment, line }) => (
              <span className="flex flex-col gap-1" key={line}>
                <span className="text-muted-foreground"># {comment}</span>
                <span>
                  <span className="text-primary">$ </span>
                  {line}
                </span>
              </span>
            ))}
          </code>
        </pre>
        <p className="text-muted-foreground border-t px-6 py-3 text-xs">
          Node.js 22+ · Postgres or Docker · bun, pnpm and npm all welcome
        </p>
      </div>
    </div>
  </MarketingSection>
)
