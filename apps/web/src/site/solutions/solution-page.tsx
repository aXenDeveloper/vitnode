import type { LucideIcon } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@vitnode/core/components/ui/accordion'
import { ArrowRight, Check, Clock, Plug, Sparkles, X } from 'lucide-react'
import { createElement } from 'react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import { ScreenFrame } from '#/site/marketing/screen-frame'
import { SCREENS } from '#/site/marketing/screens'
import {
  CanaryNotice,
  Eyebrow,
  MarketingActions,
  MarketingSection,
  SectionHeading,
  TextLink,
} from '#/site/marketing/shared'

import type { Availability, Solution, SolutionSection } from './data'

import { solutionPath } from './catalog'
import { SOLUTION_ICONS, SOLUTIONS } from './data'

const casual = (label: string) =>
  /^[A-Z][a-z]/.test(label)
    ? label.charAt(0).toLowerCase() + label.slice(1)
    : label

const renderIcon = (Icon: LucideIcon, className: string) =>
  createElement(Icon, { 'aria-hidden': true, className })

const SolutionIcon = ({
  className,
  slug,
}: {
  className: string
  slug: string
}) => renderIcon(SOLUTION_ICONS[slug] ?? Sparkles, className)

const HeroShell = ({ children }: { children: React.ReactNode }) => (
  <>
    <div aria-hidden className="mk-grid absolute inset-0 -z-10" />
    <div
      aria-hidden
      className="mk-anim-drift bg-primary/20 absolute top-0 left-1/2 -z-10 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
    />
    <div className="container mx-auto flex flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-24">
      {children}
    </div>
  </>
)

const STATUS: Record<
  Availability,
  { className: string; Icon: LucideIcon; label: string }
> = {
  available: {
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    Icon: Check,
    label: 'Available',
  },
  plugin: {
    className: 'bg-primary/10 text-primary',
    Icon: Plug,
    label: 'Build as a plugin',
  },
  roadmap: {
    className: 'bg-muted text-muted-foreground',
    Icon: Clock,
    label: 'On the roadmap',
  },
}

const FlowBlock = ({
  section,
}: {
  section: Extract<SolutionSection, { type: 'flow' }>
}) => (
  <MarketingSection labelledBy={`flow-${section.title}`}>
    <SectionHeading
      align="center"
      eyebrow={section.eyebrow}
      id={`flow-${section.title}`}
      title={section.title}
    >
      {section.description}
    </SectionHeading>
    <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {section.steps.map(({ Icon, text, title }, index) => (
        <li
          className="bg-card relative flex flex-col gap-4 rounded-3xl border p-6"
          key={title}
        >
          <div className="flex items-center justify-between">
            <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-2xl">
              {renderIcon(Icon, 'size-5')}
            </span>
            <span className="text-muted-foreground font-mono text-sm">
              0{index + 1}
            </span>
          </div>
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {text}
          </p>
        </li>
      ))}
    </ol>
  </MarketingSection>
)

const BeforeAfterBlock = ({
  section,
}: {
  section: Extract<SolutionSection, { type: 'before-after' }>
}) => (
  <div className="bg-muted/40 border-y">
    <MarketingSection labelledBy={`ba-${section.title}`}>
      <SectionHeading
        align="center"
        eyebrow={section.eyebrow}
        id={`ba-${section.title}`}
        title={section.title}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card flex flex-col gap-4 rounded-3xl border p-6 sm:p-8">
          <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
            Before
          </p>
          <ul className="flex flex-col gap-3">
            {section.before.map((item) => (
              <li className="flex items-start gap-3" key={item}>
                <span className="bg-muted text-muted-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
                  <X aria-hidden className="size-3.5" strokeWidth={3} />
                </span>
                <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-card border-primary/40 flex flex-col gap-4 rounded-3xl border p-6 shadow-lg sm:p-8">
          <p className="text-primary text-sm font-semibold tracking-wide uppercase">
            With VitNode
          </p>
          <ul className="flex flex-col gap-3">
            {section.after.map((item) => (
              <li className="flex items-start gap-3" key={item}>
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Check aria-hidden className="size-3.5" strokeWidth={3} />
                </span>
                <span className="text-sm leading-relaxed text-pretty">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </MarketingSection>
  </div>
)

const FeatureBlock = ({
  reverse,
  section,
}: {
  reverse: boolean
  section: Extract<SolutionSection, { type: 'feature' }>
}) => (
  <MarketingSection labelledBy={`feature-${section.title}`}>
    <article className="grid items-center gap-8 lg:grid-cols-2">
      <div
        className={
          reverse ? 'flex flex-col gap-5 lg:order-2' : 'flex flex-col gap-5'
        }
      >
        <h2
          className="text-2xl font-semibold tracking-tight text-balance sm:text-4xl"
          id={`feature-${section.title}`}
        >
          {section.title}
        </h2>
        <p className="text-muted-foreground text-base leading-relaxed text-pretty">
          {section.text}
        </p>
        <ul className="flex flex-col gap-2">
          {section.bullets.map((bullet) => (
            <li className="flex items-start gap-2 text-sm" key={bullet}>
              <Check
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                strokeWidth={3}
              />
              {bullet}
            </li>
          ))}
        </ul>
      </div>
      <ScreenFrame
        note={section.illustrative ? 'Illustrative screenshot' : undefined}
        screen={SCREENS[section.screen]}
      />
    </article>
  </MarketingSection>
)

const ChecklistBlock = ({
  section,
}: {
  section: Extract<SolutionSection, { type: 'checklist' }>
}) => (
  <div className="bg-muted/40 border-y">
    <MarketingSection labelledBy={`check-${section.title}`}>
      <SectionHeading
        eyebrow={section.eyebrow}
        id={`check-${section.title}`}
        title={section.title}
      >
        {section.description}
      </SectionHeading>
      <ul className="grid gap-3 sm:grid-cols-2">
        {section.items.map(({ label, status }) => {
          const meta = STATUS[status]

          return (
            <li
              className="bg-card flex items-center justify-between gap-4 rounded-2xl border px-4 py-3"
              key={label}
            >
              <span className="text-sm font-medium text-pretty">{label}</span>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}
              >
                {renderIcon(meta.Icon, 'size-3.5')}
                {meta.label}
              </span>
            </li>
          )
        })}
      </ul>
    </MarketingSection>
  </div>
)

const LADDER_OFFSET = [
  '',
  'lg:translate-y-3',
  'lg:translate-y-6',
  'lg:translate-y-9',
]

const LadderBlock = ({
  section,
}: {
  section: Extract<SolutionSection, { type: 'ladder' }>
}) => (
  <MarketingSection labelledBy={`ladder-${section.title}`}>
    <SectionHeading
      eyebrow={section.eyebrow}
      id={`ladder-${section.title}`}
      title={section.title}
    >
      {section.description}
    </SectionHeading>
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {section.tiers.map(({ name, perks }, index) => (
        <li
          className={`bg-card flex flex-col gap-3 rounded-3xl border p-6 ${LADDER_OFFSET[index] ?? ''}`}
          key={name}
        >
          <span className="text-muted-foreground font-mono text-xs">
            Level {index + 1}
          </span>
          <h3 className="text-primary text-lg font-semibold tracking-tight">
            {name}
          </h3>
          <ul className="flex flex-col gap-2">
            {perks.map((perk) => (
              <li
                className="text-muted-foreground flex items-start gap-2 text-sm leading-relaxed"
                key={perk}
              >
                <Check
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  strokeWidth={3}
                />
                {perk}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
    <ScreenFrame screen={SCREENS[section.screen]} />
  </MarketingSection>
)

const GalleryBlock = ({
  section,
}: {
  section: Extract<SolutionSection, { type: 'gallery' }>
}) => (
  <MarketingSection labelledBy={`gallery-${section.title}`}>
    <SectionHeading
      align="center"
      eyebrow={section.eyebrow}
      id={`gallery-${section.title}`}
      title={section.title}
    >
      {section.description}
    </SectionHeading>
    <div className="grid gap-6 lg:grid-cols-2">
      {section.screens.map(({ caption, screen }) => (
        <figure className="flex min-w-0 flex-col gap-3" key={screen}>
          <ScreenFrame screen={SCREENS[screen]} />
          <figcaption className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {caption}
          </figcaption>
        </figure>
      ))}
    </div>
  </MarketingSection>
)

const ModelBlock = ({
  section,
}: {
  section: Extract<SolutionSection, { type: 'model' }>
}) => (
  <div className="bg-muted/40 border-y">
    <MarketingSection labelledBy={`model-${section.title}`}>
      <SectionHeading
        eyebrow={section.eyebrow}
        id={`model-${section.title}`}
        title={section.title}
      >
        {section.description}
      </SectionHeading>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {section.types.map(({ fields, name }, index) => (
          <li className="flex flex-col gap-3" key={name}>
            <div className="bg-card overflow-hidden rounded-2xl border">
              <div className="bg-primary text-primary-foreground flex items-center justify-between px-4 py-2 font-mono text-xs">
                <span>defineContentType</span>
                <span>{index + 1}</span>
              </div>
              <div className="flex flex-col gap-2 p-4">
                <h3 className="text-lg font-semibold tracking-tight">{name}</h3>
                <ul className="flex flex-col gap-1">
                  {fields.map((field) => (
                    <li
                      className="text-muted-foreground bg-muted/60 rounded-md px-2 py-1 font-mono text-xs"
                      key={field}
                    >
                      {field}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {index < section.types.length - 1 ? (
              <ArrowRight
                aria-hidden
                className="text-muted-foreground mx-auto size-4 lg:hidden"
              />
            ) : null}
          </li>
        ))}
      </ol>
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        Each card is one file in your plugin. Relations and repeatable child
        records are part of the Content Engine, so a link between two types is a
        field, not a migration.
      </p>
    </MarketingSection>
  </div>
)

const FaqBlock = ({
  section,
}: {
  section: Extract<SolutionSection, { type: 'faq' }>
}) => (
  <MarketingSection labelledBy={`faq-${section.title}`}>
    <SectionHeading
      align="center"
      eyebrow="Very fair questions"
      id={`faq-${section.title}`}
      title={section.title}
    />
    <Accordion className="bg-card mx-auto w-full max-w-3xl rounded-3xl border px-6">
      {section.items.map(({ answer, question }) => (
        <AccordionItem key={question} value={question}>
          <AccordionTrigger className="text-base">{question}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground leading-relaxed text-pretty">
            {answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </MarketingSection>
)

const featuresBefore = (sections: SolutionSection[], index: number) =>
  sections.slice(0, index).filter((item) => item.type === 'feature').length

const SolutionSections = ({ sections }: { sections: SolutionSection[] }) => (
  <>
    {sections.map((section, index) => {
      switch (section.type) {
        case 'before-after':
          return <BeforeAfterBlock key={section.title} section={section} />
        case 'checklist':
          return <ChecklistBlock key={section.title} section={section} />
        case 'faq':
          return <FaqBlock key={section.title} section={section} />
        case 'feature':
          return (
            <FeatureBlock
              key={section.title}
              reverse={featuresBefore(sections, index) % 2 === 1}
              section={section}
            />
          )
        case 'flow':
          return <FlowBlock key={section.title} section={section} />
        case 'gallery':
          return <GalleryBlock key={section.title} section={section} />
        case 'ladder':
          return <LadderBlock key={section.title} section={section} />
        case 'model':
          return <ModelBlock key={section.title} section={section} />
      }
    })}
  </>
)

const SolutionCard = ({
  LinkComponent,
  solution,
  variant,
}: {
  LinkComponent: SiteLinkComponent
  solution: Solution
  variant: 'compact' | 'full'
}) => (
  <LinkComponent
    className="group bg-card hover:border-primary/40 flex h-full flex-col gap-3 rounded-3xl border p-6 transition-colors"
    href={solutionPath(solution.slug)}
  >
    <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
      <SolutionIcon className="size-5" slug={solution.slug} />
    </span>
    <span className="text-xl font-semibold tracking-tight">
      {solution.name}
    </span>
    <span className="text-primary text-sm font-semibold">
      {solution.tagline}
    </span>
    {variant === 'full' ? (
      <>
        <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {solution.description}
        </span>
        <span className="text-muted-foreground mt-auto text-xs">
          For {solution.audience.slice(0, 3).map(casual).join(', ')} and more
        </span>
      </>
    ) : null}
    <span className="text-primary mt-auto inline-flex items-center gap-1 text-sm font-semibold">
      See the solution
      <ArrowRight
        aria-hidden
        className="size-4 transition-transform group-hover:translate-x-0.5"
      />
    </span>
  </LinkComponent>
)

export const SolutionPage = ({
  LinkComponent,
  solution,
}: {
  LinkComponent: SiteLinkComponent
  solution: Solution
}) => {
  const others = SOLUTIONS.filter((item) => item.slug !== solution.slug)

  return (
    <div className="flex flex-col">
      <section
        aria-labelledby="solution-title"
        className="relative overflow-hidden"
      >
        <HeroShell>
          <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
            <SolutionIcon
              className="mk-anim-float size-7"
              slug={solution.slug}
            />
          </span>
          <Eyebrow>{solution.eyebrow}</Eyebrow>
          <h1
            className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
            id="solution-title"
          >
            {solution.title}
          </h1>
          <p className="text-muted-foreground max-w-2xl text-base leading-relaxed text-pretty sm:text-lg">
            {solution.description}
          </p>
          <MarketingActions
            className="justify-center"
            LinkComponent={LinkComponent}
          />
          <ul className="flex flex-wrap justify-center gap-2">
            {solution.audience.map((item) => (
              <li
                className="bg-card rounded-full border px-3 py-1 text-xs font-semibold"
                key={item}
              >
                {item}
              </li>
            ))}
          </ul>
          <div className="w-full max-w-5xl pt-6">
            <ScreenFrame priority screen={SCREENS[solution.heroScreen]} />
          </div>
        </HeroShell>
      </section>

      <SolutionSections sections={solution.sections} />

      <MarketingSection labelledBy="solution-others-title">
        <SectionHeading
          eyebrow="Other solutions"
          id="solution-others-title"
          title="Same framework, a different site."
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {others.map((item) => (
            <li key={item.slug}>
              <SolutionCard
                LinkComponent={LinkComponent}
                solution={item}
                variant="compact"
              />
            </li>
          ))}
        </ul>
        <CanaryNotice LinkComponent={LinkComponent} />
      </MarketingSection>

      <section
        aria-labelledby="solution-cta-title"
        className="container mx-auto px-4 pb-16 sm:px-6 sm:pb-24"
      >
        <div className="bg-card flex flex-col items-center gap-6 rounded-3xl border px-6 py-16 text-center">
          <h2
            className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl"
            id="solution-cta-title"
          >
            Start with the boring parts already done.
          </h2>
          <p className="text-muted-foreground max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
            Scaffold an app, add your first plugin and show it to your people
            this week. It costs exactly nothing.
          </p>
          <MarketingActions
            className="justify-center"
            LinkComponent={LinkComponent}
          />
          <TextLink href="/plugins" LinkComponent={LinkComponent}>
            See the plugins that ship today
          </TextLink>
        </div>
      </section>
    </div>
  )
}

export const SolutionsIndexPage = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <div className="flex flex-col">
    <section
      aria-labelledby="solutions-title"
      className="relative overflow-hidden"
    >
      <HeroShell>
        <Eyebrow>Solutions</Eyebrow>
        <h1
          className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          id="solutions-title"
        >
          Same framework. Five very different sites.
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed text-pretty sm:text-lg">
          A help center, a membership site, an open-source hub, a gaming guild
          and a multilingual magazine. Each solution shows the flow, the roles
          and the real screens for that kind of site, then hands you the keys.
        </p>
      </HeroShell>
    </section>

    <MarketingSection labelledBy="solutions-list-title">
      <h2 className="sr-only" id="solutions-list-title">
        Solutions
      </h2>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SOLUTIONS.map((solution) => (
          <li key={solution.slug}>
            <SolutionCard
              LinkComponent={LinkComponent}
              solution={solution}
              variant="full"
            />
          </li>
        ))}
      </ul>
      <CanaryNotice LinkComponent={LinkComponent} />
    </MarketingSection>
  </div>
)
