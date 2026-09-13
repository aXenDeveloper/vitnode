import { cn } from 'cn'

import {
  ActionLink,
  MarketingSection,
  SectionHeading,
  SectionRow,
  SURFACE,
} from '@/site/marketing/shared'

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

export const DevelopersSection = () => (
  <MarketingSection id="developers" labelledBy="developers-title">
    <SectionRow
      action={
        <ActionLink params={{ _splat: 'guides/first-plugin' }} to="/docs/$">
          Build your first plugin
        </ActionLink>
      }
    >
      <SectionHeading
        eyebrow="A little something for the builders"
        id="developers-title"
        title="Less setup déjà vu."
      >
        Start a project, build a plugin, make it yours. Familiar tools
        underneath, end-to-end types in between, and more of your actual product
        on top.
      </SectionHeading>
    </SectionRow>

    <div className="grid items-stretch gap-6 lg:grid-cols-5">
      <div
        className={cn(
          SURFACE.soft,
          'flex flex-col gap-6 p-7 sm:p-8 lg:col-span-2',
        )}
      >
        <h3 className="text-xl font-semibold tracking-tight">
          The stack underneath
        </h3>
        <ul className="flex flex-wrap gap-2">
          {STACK.map((item) => (
            <li
              className="bg-background rounded-full px-3.5 py-1.5 text-sm font-medium"
              key={item}
            >
              {item}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground font-book leading-relaxed text-pretty">
          Node.js 22+, Postgres or Docker, and whichever package manager you
          already argue about. bun, pnpm and npm are all welcome.
        </p>
      </div>

      <div className={cn(SURFACE.dark, 'overflow-hidden lg:col-span-3')}>
        <div className="bg-muted/60 flex items-center gap-2 border-b px-5 py-3">
          <span aria-hidden className="flex gap-1.5">
            <span className="size-3 rounded-full bg-red-400/80" />
            <span className="size-3 rounded-full bg-amber-400/80" />
            <span className="size-3 rounded-full bg-emerald-400/80" />
          </span>
          <span className="text-muted-foreground mx-auto font-mono text-xs">
            terminal
          </span>
        </div>
        <pre className="overflow-x-auto p-7 font-mono text-sm leading-relaxed sm:p-8">
          <code className="flex flex-col gap-5">
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
      </div>
    </div>
  </MarketingSection>
)
