import type { LucideIcon } from 'lucide-react'

import { Link } from '@tanstack/react-router'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@vitnode/core/components/ui/accordion'
import { cn } from 'cn'
import {
  ArrowRight,
  BadgeDollarSign,
  Check,
  Clock,
  ExternalLink,
  Minus,
  Puzzle,
  X,
} from 'lucide-react'
import { createElement } from 'react'

import { MarketingPage } from '@/site/marketing/marketing-page'
import {
  CanaryNotice,
  Eyebrow,
  HeroShell,
  MarketingActions,
  MarketingSection,
  SectionHeading,
  SURFACE,
  TextLink,
} from '@/site/marketing/shared'

import type { Cell, Competitor, Support } from './data'

import {
  CHECKED_ON,
  CHECKED_ON_LABEL,
  COMPETITORS,
  FACTS,
  FEATURE_GROUPS,
  VITNODE,
} from './data'

const SUPPORT: Record<
  Support,
  { className: string; Icon: LucideIcon; label: string }
> = {
  builtIn: {
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    Icon: Check,
    label: 'Built in',
  },
  missing: {
    className: 'bg-muted text-muted-foreground',
    Icon: X,
    label: 'Not available',
  },
  official: {
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    Icon: Check,
    label: 'Official plugin',
  },
  paid: {
    className: 'bg-primary/10 text-primary',
    Icon: BadgeDollarSign,
    label: 'Paid tier',
  },
  soon: {
    className: 'border-primary/40 text-primary border border-dashed',
    Icon: Clock,
    label: 'Soon',
  },
  thirdParty: {
    className: 'bg-muted text-foreground',
    Icon: Puzzle,
    label: 'Third-party',
  },
  undocumented: {
    className: 'text-muted-foreground',
    Icon: Minus,
    label: 'No information',
  },
}

const LEGEND_ORDER: Support[] = [
  'builtIn',
  'official',
  'paid',
  'thirdParty',
  'soon',
  'missing',
]

const renderIcon = (Icon: LucideIcon, className: string) =>
  createElement(Icon, { 'aria-hidden': true, className })

const SupportBadge = ({ support }: { support: Support }) => {
  const meta = SUPPORT[support]

  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        meta.className,
      )}
    >
      {renderIcon(meta.Icon, 'size-3.5')}
      {meta.label}
    </span>
  )
}

const NoInformation = () => (
  <span className="text-muted-foreground inline-flex h-6 items-center text-sm">
    <span aria-hidden>—</span>
    <span className="sr-only">{SUPPORT.undocumented.label}</span>
  </span>
)

const SupportCell = ({ cell }: { cell: Cell }) => (
  <div className="flex flex-col gap-1.5">
    {cell.support === 'undocumented' ? (
      <NoInformation />
    ) : (
      <SupportBadge support={cell.support} />
    )}
    {cell.note ? (
      <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {cell.note}
      </span>
    ) : null}
  </div>
)

const SupportIcon = ({ cell }: { cell: Cell }) => {
  const meta = SUPPORT[cell.support]
  const label = cell.note ? `${meta.label}: ${cell.note}` : meta.label

  return (
    <span
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-full',
        meta.className,
      )}
      title={label}
    >
      {renderIcon(meta.Icon, 'size-4')}
      <span className="sr-only">{label}</span>
    </span>
  )
}

const Legend = () => (
  <ul aria-label="Legend" className="flex flex-wrap gap-2">
    {LEGEND_ORDER.map((support) => (
      <li key={support}>
        <SupportBadge support={support} />
      </li>
    ))}
  </ul>
)

const SourcesNote = () => (
  <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
    Competitor facts come from each vendor’s own site, docs and repository,
    checked on <time dateTime={CHECKED_ON}>{CHECKED_ON_LABEL}</time>. A dash
    means the vendor’s site and docs say nothing about it either way. Spotted
    something out of date? Tell us on GitHub and we will fix it.
  </p>
)

const HeadToHeadTable = ({ competitor }: { competitor: Competitor }) => (
  <div className="bg-muted/60 relative overflow-x-auto rounded-3xl">
    <table className="w-full min-w-2xl text-left">
      <caption className="sr-only">
        VitNode and {competitor.name} compared feature by feature
      </caption>
      <thead>
        <tr className="border-b">
          <th className="w-1/3 p-4 text-sm font-semibold" scope="col">
            Feature
          </th>
          <th
            className="text-primary w-1/3 p-4 text-sm font-semibold"
            scope="col"
          >
            VitNode
          </th>
          <th className="w-1/3 p-4 text-sm font-semibold" scope="col">
            {competitor.name}
          </th>
        </tr>
      </thead>
      <tbody>
        {FACTS.map(({ key, label }) => (
          <tr className="border-b align-top" key={key}>
            <th className="p-4 text-sm font-medium" scope="row">
              {label}
            </th>
            <td className="p-4 text-sm leading-relaxed text-pretty">
              {VITNODE.facts[key]}
            </td>
            <td className="p-4 text-sm leading-relaxed text-pretty">
              {competitor.facts[key]}
            </td>
          </tr>
        ))}
      </tbody>
      {FEATURE_GROUPS.map((group) => (
        <tbody key={group.title}>
          <tr className="bg-muted/60 border-b">
            <th
              className="text-muted-foreground p-4 font-mono text-xs font-medium tracking-wider uppercase"
              colSpan={3}
              scope="rowgroup"
            >
              {group.title}
            </th>
          </tr>
          {group.features.map(({ key, label }) => (
            <tr className="border-b align-top last:border-b-0" key={key}>
              <th className="p-4 text-sm font-medium" scope="row">
                {label}
              </th>
              <td className="p-4">
                <SupportCell cell={VITNODE.features[key]} />
              </td>
              <td className="p-4">
                <SupportCell cell={competitor.features[key]} />
              </td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  </div>
)

const MatrixTable = () => (
  <div className="bg-muted/60 relative overflow-x-auto rounded-3xl">
    <table className="w-full min-w-5xl text-left">
      <caption className="sr-only">
        VitNode compared with Discourse, Flarum, Invision Community, NodeBB,
        WordPress with bbPress and XenForo
      </caption>
      <thead>
        <tr className="border-b">
          <th className="p-4 text-sm font-semibold" scope="col">
            Feature
          </th>
          <th className="text-primary p-4 text-sm font-semibold" scope="col">
            VitNode
          </th>
          {COMPETITORS.map((competitor) => (
            <th
              className="p-4 text-sm font-semibold"
              key={competitor.slug}
              scope="col"
            >
              <Link
                className="hover:text-primary underline-offset-4 hover:underline"
                params={{ slug: competitor.slug }}
                to="/compare/$slug"
              >
                {competitor.name}
              </Link>
            </th>
          ))}
        </tr>
      </thead>
      {FEATURE_GROUPS.map((group) => (
        <tbody key={group.title}>
          <tr className="bg-muted/60 border-b">
            <th
              className="text-muted-foreground p-4 font-mono text-xs font-medium tracking-wider uppercase"
              colSpan={COMPETITORS.length + 2}
              scope="rowgroup"
            >
              {group.title}
            </th>
          </tr>
          {group.features.map(({ key, label }) => (
            <tr className="border-b last:border-b-0" key={key}>
              <th className="p-4 text-sm font-medium" scope="row">
                {label}
              </th>
              <td className="p-4">
                <SupportIcon cell={VITNODE.features[key]} />
              </td>
              {COMPETITORS.map((competitor) => (
                <td className="p-4" key={competitor.slug}>
                  <SupportIcon cell={competitor.features[key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  </div>
)

const PickList = ({
  highlighted,
  items,
  title,
}: {
  highlighted?: boolean
  items: string[]
  title: string
}) => (
  <div
    className={cn(
      'bg-muted/60 flex flex-col gap-4 rounded-3xl p-6 sm:p-8',
      highlighted && 'border-primary/40 border shadow-lg',
    )}
  >
    <h3
      className={cn(
        'text-sm font-semibold tracking-wide uppercase',
        highlighted ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      {title}
    </h3>
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li className="flex items-start gap-3" key={item}>
          <Check
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            strokeWidth={3}
          />
          <span className="text-sm leading-relaxed text-pretty">{item}</span>
        </li>
      ))}
    </ul>
  </div>
)

const CompareCard = ({ competitor }: { competitor: Competitor }) => (
  <Link
    className="group bg-muted/60 hover:bg-primary/10 flex h-full flex-col gap-3 rounded-3xl p-6 transition-colors"
    params={{ slug: competitor.slug }}
    to="/compare/$slug"
  >
    <span className="text-muted-foreground font-mono text-xs">VitNode vs</span>
    <span className="text-xl font-semibold tracking-tight">
      {competitor.name}
    </span>
    <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
      {competitor.facts.licence} · {competitor.facts.stack}
    </span>
    <span className="text-primary mt-auto inline-flex items-center gap-1 text-sm font-semibold">
      Read the comparison
      <ArrowRight
        aria-hidden
        className="size-4 transition-transform group-hover:translate-x-0.5"
      />
    </span>
  </Link>
)

const CompareCta = () => (
  <section
    aria-labelledby="compare-cta-title"
    className="container mx-auto px-4 pb-16 sm:px-6 sm:pb-24"
  >
    <div className="bg-muted/60 flex flex-col items-center gap-6 rounded-3xl px-6 py-16 text-center">
      <h2
        className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl"
        id="compare-cta-title"
      >
        Try it on your next project.
      </h2>
      <p className="text-muted-foreground max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
        Scaffold an app in a few minutes, poke around the AdminCP and see if it
        fits. If it does not, you have lost nothing but a coffee break.
      </p>
      <MarketingActions className="justify-center" />
    </div>
  </section>
)

export const ComparePage = ({ competitor }: { competitor: Competitor }) => {
  const others = COMPETITORS.filter((item) => item.slug !== competitor.slug)

  return (
    <MarketingPage>
      <section
        aria-labelledby="compare-title"
        className="relative overflow-hidden"
      >
        <HeroShell>
          <Eyebrow>Compare</Eyebrow>
          <h1
            className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
            id="compare-title"
          >
            VitNode vs {competitor.name}
          </h1>
          <p className="text-muted-foreground max-w-2xl text-base leading-relaxed text-pretty sm:text-lg">
            {competitor.summary}
          </p>
          <MarketingActions className="justify-center" />
        </HeroShell>
      </section>

      <MarketingSection labelledBy="compare-advantages-title">
        <SectionHeading
          eyebrow="Why switch"
          id="compare-advantages-title"
          title={`Where VitNode is ahead of ${competitor.name}.`}
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {competitor.advantages.map(({ text, title }) => (
            <li
              className="bg-card flex flex-col gap-3 rounded-2xl border p-6"
              key={title}
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <Check aria-hidden className="size-4" strokeWidth={3} />
              </span>
              <h3 className="text-lg font-semibold tracking-tight text-balance">
                {title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                {text}
              </p>
            </li>
          ))}
        </ul>
      </MarketingSection>

      <MarketingSection labelledBy="compare-table-title">
        <SectionHeading
          eyebrow="At a glance"
          id="compare-table-title"
          title="Side by side, row by row."
        >
          In their words: “{competitor.positioning}” Here is what each one ships
          today.
        </SectionHeading>
        <Legend />
        <HeadToHeadTable competitor={competitor} />
        <SourcesNote />
      </MarketingSection>

      <div className="bg-muted/40 border-y">
        <MarketingSection labelledBy="compare-differences-title">
          <SectionHeading
            eyebrow="The differences that matter"
            id="compare-differences-title"
            title="Where they really differ."
          />
          <div className="grid gap-4 md:grid-cols-2">
            {competitor.differences.map(({ text, title }) => (
              <article
                className="bg-muted/60 flex flex-col gap-3 rounded-3xl p-6 sm:p-8"
                key={title}
              >
                <h3 className="text-xl font-semibold tracking-tight text-balance">
                  {title}
                </h3>
                <p className="text-muted-foreground leading-relaxed text-pretty">
                  {text}
                </p>
              </article>
            ))}
          </div>
        </MarketingSection>
      </div>

      <MarketingSection labelledBy="compare-pick-title">
        <SectionHeading
          align="center"
          eyebrow="Honest advice"
          id="compare-pick-title"
          title="Which one should you pick?"
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <PickList
            items={competitor.pickThem}
            title={`Pick ${competitor.name} if`}
          />
          <PickList
            highlighted
            items={competitor.pickVitnode}
            title="Pick VitNode if"
          />
        </div>
      </MarketingSection>

      <MarketingSection labelledBy="compare-migration-title">
        <div className={cn(SURFACE.tint, 'flex flex-col gap-4 p-6 sm:p-8')}>
          <h2
            className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
            id="compare-migration-title"
          >
            Moving from {competitor.name}
          </h2>
          <p className="text-muted-foreground max-w-3xl leading-relaxed text-pretty">
            {competitor.migration}
          </p>
        </div>
        <CanaryNotice />
      </MarketingSection>

      <MarketingSection labelledBy="compare-faq-title">
        <SectionHeading
          align="center"
          eyebrow="Very fair questions"
          id="compare-faq-title"
          title={`VitNode and ${competitor.name}, answered.`}
        />
        <Accordion className="bg-muted/60 mx-auto w-full max-w-3xl rounded-3xl px-6">
          {competitor.faq.map(({ answer, question }) => (
            <AccordionItem key={question} value={question}>
              <AccordionTrigger className="text-base">
                {question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed text-pretty">
                {answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </MarketingSection>

      <MarketingSection labelledBy="compare-sources-title">
        <div className="flex flex-col gap-4">
          <h2
            className="text-xl font-semibold tracking-tight"
            id="compare-sources-title"
          >
            Sources
          </h2>
          <SourcesNote />
          <ul className="grid gap-2 sm:grid-cols-2">
            {competitor.sources.map(({ label, url }) => (
              <li key={url}>
                <a
                  className="text-primary inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
                  href={url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {label}
                  <ExternalLink aria-hidden className="size-3.5" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </MarketingSection>

      <MarketingSection labelledBy="compare-others-title">
        <SectionHeading
          eyebrow="More comparisons"
          id="compare-others-title"
          title="Weighing up something else?"
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {others.map((item) => (
            <li key={item.slug}>
              <CompareCard competitor={item} />
            </li>
          ))}
        </ul>
        <TextLink to="/compare">See every platform in one table</TextLink>
      </MarketingSection>

      <CompareCta />
    </MarketingPage>
  )
}

export const CompareIndexPage = () => (
  <MarketingPage>
    <section
      aria-labelledby="compare-index-title"
      className="relative overflow-hidden"
    >
      <HeroShell>
        <Eyebrow>Compare</Eyebrow>
        <h1
          className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          id="compare-index-title"
        >
          VitNode next to the platforms you already know.
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed text-pretty sm:text-lg">
          Invision Community, XenForo, Discourse, Flarum, NodeBB and WordPress
          with bbPress, compared on what each one ships today. Where VitNode
          falls short, the table says so too.
        </p>
      </HeroShell>
    </section>

    <MarketingSection labelledBy="compare-matrix-title">
      <SectionHeading
        eyebrow="Everything in one table"
        id="compare-matrix-title"
        title="Seven platforms, eighteen questions."
      >
        A quick scan first. Each comparison below explains every mark, with
        prices and sources.
      </SectionHeading>
      <Legend />
      <MatrixTable />
      <SourcesNote />
    </MarketingSection>

    <MarketingSection labelledBy="compare-list-title">
      <SectionHeading
        eyebrow="Head to head"
        id="compare-list-title"
        title="Pick a comparison."
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COMPETITORS.map((competitor) => (
          <li key={competitor.slug}>
            <CompareCard competitor={competitor} />
          </li>
        ))}
      </ul>
      <CanaryNotice />
    </MarketingSection>

    <CompareCta />
  </MarketingPage>
)
