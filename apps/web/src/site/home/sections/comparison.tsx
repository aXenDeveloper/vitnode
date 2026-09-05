import { Check } from 'lucide-react'

import { MarketingSection, SectionHeading } from '#/site/marketing/shared'

const COLUMNS = [
  { name: 'VitNode', note: 'Open-source framework' },
  { name: 'Discourse', note: 'Forum software' },
  { name: 'Circle', note: 'Hosted platform' },
  { name: 'From scratch', note: 'Your own codebase' },
]

const ROWS: { feature: string; values: boolean[] }[] = [
  {
    feature: 'Open-source code you can change',
    values: [true, true, false, true],
  },
  {
    feature: 'Self-host with zero licence fees',
    values: [true, true, false, true],
  },
  {
    feature: 'Add your own features as plugins',
    values: [true, true, false, false],
  },
  {
    feature:
      'Content Engine: describe a content type, get table, API and admin screens',
    values: [true, false, false, false],
  },
  {
    feature: 'Admin Control Panel out of the box',
    values: [true, true, true, false],
  },
  {
    feature: 'Roles and granular staff permissions',
    values: [true, true, true, false],
  },
  {
    feature: 'Multi-language interface and content',
    values: [true, true, false, false],
  },
  {
    feature: 'Real-time notifications over WebSockets',
    values: [true, true, true, false],
  },
  {
    feature: 'AI building blocks with the provider you choose',
    values: [true, true, true, false],
  },
  {
    feature: 'Social sign-in and captcha built in',
    values: [true, true, true, false],
  },
  {
    feature: 'Docs packaged for AI coding agents',
    values: [true, false, false, false],
  },
  {
    feature: 'Ready-made discussion forum on day one',
    values: [false, true, true, false],
  },
  {
    feature: 'Managed hosting sold by the vendor',
    values: [false, true, true, false],
  },
]

const Mark = ({ available }: { available: boolean }) => (
  <>
    <span
      className={
        available
          ? 'inline-flex size-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
          : 'bg-muted text-muted-foreground/40 inline-flex size-7 items-center justify-center rounded-full'
      }
    >
      <Check aria-hidden className="size-4" strokeWidth={3} />
    </span>
    <span className="sr-only">
      {available ? 'Available' : 'Not available or not included'}
    </span>
  </>
)

export const ComparisonSection = () => (
  <MarketingSection id="compare" labelledBy="compare-title">
    <SectionHeading
      align="center"
      eyebrow="Different tools. Different sweet spots."
      id="compare-title"
      title="How VitNode compares."
    >
      Pick VitNode when you want a community application that is truly yours.
      Pick a finished platform when a forum you can switch on today is the whole
      goal.
    </SectionHeading>

    <p className="text-muted-foreground -mb-8 text-center text-xs sm:hidden">
      Swipe sideways to compare all four columns.
    </p>

    <div
      aria-label="Community platform comparison"
      className="bg-card relative overflow-x-auto rounded-3xl border"
      role="region"
      tabIndex={0}
    >
      <table className="w-full min-w-3xl border-collapse text-sm">
        <caption className="sr-only">
          VitNode canary compared with Discourse, Circle and building from
          scratch, checked in September 2026
        </caption>
        <thead>
          <tr className="border-b">
            <th
              className="min-w-56 px-6 py-4 text-left font-medium"
              scope="col"
            >
              What matters to you
            </th>
            {COLUMNS.map(({ name, note }, index) => (
              <th
                className={
                  index === 0
                    ? 'bg-primary/5 px-4 py-4 text-center'
                    : 'px-4 py-4 text-center'
                }
                key={name}
                scope="col"
              >
                <span className="flex flex-col gap-0.5">
                  <span
                    className={
                      index === 0
                        ? 'text-primary font-semibold'
                        : 'font-semibold'
                    }
                  >
                    {name}
                  </span>
                  <span className="text-muted-foreground text-xs font-normal">
                    {note}
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ feature, values }) => (
            <tr className="border-b last:border-b-0" key={feature}>
              <th
                className="px-6 py-3 text-left font-normal text-pretty"
                scope="row"
              >
                {feature}
              </th>
              {COLUMNS.map(({ name }, index) => (
                <td
                  className={
                    index === 0
                      ? 'bg-primary/5 px-4 py-3 text-center'
                      : 'px-4 py-3 text-center'
                  }
                  key={name}
                >
                  <Mark available={values[index] ?? false} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="text-muted-foreground flex flex-col gap-2 text-xs leading-relaxed">
      <p className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5">
          <Mark available />
          Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Mark available={false} />
          Not available or not included
        </span>
      </p>
      <p className="text-pretty">
        Checked in September 2026 from public documentation and pricing pages.
        Some features need setup, a plugin or a paid plan. VitNode provides AI
        building blocks rather than a finished assistant, and a dedicated
        Moderator CP is on the roadmap. Self-hosting still has infrastructure
        costs.
      </p>
    </div>
  </MarketingSection>
)
