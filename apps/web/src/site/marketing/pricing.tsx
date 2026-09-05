import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@vitnode/core/components/ui/accordion'
import { cn } from '@vitnode/core/lib/utils'
import { RouteMessages } from '@vitnode/core/tanstack/i18n'
import { RouterLink } from '@vitnode/core/tanstack/layout'
import { Check, Coffee, Crown, Rocket, Sprout } from 'lucide-react'

import { LICENSE_URL } from './links'
import {
  CanaryNotice,
  Eyebrow,
  MarketingActions,
  MarketingSection,
  SectionHeading,
  TextLink,
} from './shared'

const PLANS = [
  {
    audience: 'For the side project that might become the main project.',
    features: [
      'The entire framework, no feature flags',
      'Plugins, Content Engine and AdminCP',
      'Roles, staff permissions and SSO',
      'Unlimited members. Yes, really.',
    ],
    Icon: Sprout,
    name: 'Hobby',
  },
  {
    audience:
      'For companies that would like to keep the customer relationship, thanks.',
    featured: true,
    features: [
      'Everything in Hobby',
      'Commercial use under the MIT licence',
      'Self-host or bring your own cloud',
      'Real-time notifications, search, AI, i18n',
      'Docs your AI coding agent can read',
    ],
    Icon: Rocket,
    name: 'Business',
  },
  {
    audience: 'For when the community outgrows the planet.',
    features: [
      'Everything in Business',
      'Redis, Elasticsearch and horizontal scaling',
      'The same source code as everyone else',
      'A warm feeling when you star the repo',
    ],
    Icon: Crown,
    name: 'Galactic',
  },
]

const REAL_COSTS = [
  {
    text: 'Hosting, a Postgres database, a domain and backups. Managed or self-run, your choice.',
    title: 'A place to live',
  },
  {
    text: 'Email delivery, file storage, a search cluster, AI provider usage. Only the ones you switch on.',
    title: 'The extras you choose',
  },
  {
    text: 'Development time, updates and maintenance. Frameworks are free. Attention is not.',
    title: 'A little care and feeding',
  },
]

const FAQS = [
  {
    answer:
      'Yes. VitNode is open-source software under the MIT licence. There is no subscription, no per-member fee and no paid tier hiding behind a “Contact sales” button. You pay for the infrastructure and services you choose to run it on.',
    question: 'Is VitNode actually free?',
  },
  {
    answer:
      'Yes. The MIT licence allows commercial use, modification and redistribution. Keep the copyright and licence notice when you distribute the software. Your client project can be as serious as you like; this page does not have to be.',
    question: 'Can I use it for my company or a client?',
  },
  {
    answer:
      'Not today. Deploy to your own cloud account with the Vercel guide or self-host on a server or in Docker. The built-in WebSocket server, local uploads and in-process cron want a long-lived process, which is where self-hosting shines.',
    question: 'Does VitNode offer a managed cloud plan?',
  },
  {
    answer:
      'Canary is a very early development build. Expect breaking changes, bugs and unfinished features. It is perfect for exploring, prototyping and shaping the roadmap, and not yet the place for a production community you cannot afford to break.',
    question: 'Is the canary ready for my live community?',
  },
  {
    answer:
      'Try it, report a reproducible bug, improve the docs, contribute a plugin, or tell us what you are building. Helpful feedback is the strongest currency around here, followed closely by GitHub stars.',
    question: 'How can I support the project?',
  },
]

export const PricingBreadcrumb = () => (
  <RouteMessages>
    <span>Pricing</span>
  </RouteMessages>
)

export const PricingPage = () => (
  <div className="flex flex-col">
    <section
      aria-labelledby="pricing-title"
      className="relative overflow-hidden"
    >
      <div aria-hidden className="mk-grid absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="mk-anim-drift bg-primary/20 absolute top-0 left-1/2 -z-10 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
      />
      <div className="container mx-auto flex flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-24">
        <Eyebrow>Pricing. A very short negotiation.</Eyebrow>
        <h1
          className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          id="pricing-title"
        >
          Big community energy.{' '}
          <span className="text-primary">Zero licence fees.</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed text-pretty sm:text-lg">
          Three plans, because every pricing page has three plans. They all cost
          the same and include the same everything. We just like columns.
        </p>
        <span className="bg-card inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm">
          <Coffee aria-hidden className="text-primary size-4" />
          Your coffee costs more than our software.
        </span>
      </div>
    </section>

    <section
      aria-label="VitNode pricing plans"
      className="container mx-auto flex flex-col gap-8 px-4 pb-16 sm:px-6"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map(({ audience, featured, features, Icon, name }) => (
          <article
            className={cn(
              'bg-card relative flex flex-col gap-6 rounded-3xl border p-6 sm:p-8',
              featured && 'border-primary shadow-primary/10 shadow-xl',
            )}
            key={name}
          >
            {featured ? (
              <span className="bg-primary text-primary-foreground absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold">
                Most popular, statistically
              </span>
            ) : null}
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                <Icon aria-hidden className="size-5" />
              </span>
              <h2 className="text-xl font-semibold">{name}</h2>
            </div>
            <p className="flex items-baseline gap-2">
              <span className="text-5xl font-semibold tracking-tight">$0</span>
              <span className="text-muted-foreground text-sm">/ forever</span>
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {audience}
            </p>
            <ul className="flex flex-col gap-3">
              {features.map((feature) => (
                <li className="flex items-start gap-2 text-sm" key={feature}>
                  <Check
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                    strokeWidth={3}
                  />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-auto">
              <MarketingActions LinkComponent={RouterLink} />
            </div>
          </article>
        ))}
      </div>

      <p className="text-muted-foreground text-center text-xs">
        Current canary features. Provider setup may be required. No managed
        hosting or support SLA is included, because there is no invoice to
        attach it to.
      </p>
    </section>

    <MarketingSection labelledBy="costs-title">
      <div className="grid gap-10 lg:grid-cols-2">
        <SectionHeading
          eyebrow="The part where we are honest"
          id="costs-title"
          title="Servers still enjoy being paid."
        >
          The framework is free. Running a community has its own costs, and they
          are yours to pick. Here is the full list, no asterisk.
        </SectionHeading>

        <ul className="flex flex-col gap-4">
          {REAL_COSTS.map(({ text, title }) => (
            <li
              className="bg-card flex flex-col gap-1 rounded-2xl border p-5"
              key={title}
            >
              <h3 className="font-semibold">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                {text}
              </p>
            </li>
          ))}
          <li>
            <TextLink
              href="/docs/dev/deployments/self-hosted"
              LinkComponent={RouterLink}
            >
              Choose your setup
            </TextLink>
          </li>
        </ul>
      </div>

      <CanaryNotice LinkComponent={RouterLink} />
    </MarketingSection>

    <MarketingSection className="pt-0" labelledBy="pricing-faq-title">
      <SectionHeading
        align="center"
        eyebrow="Very fair questions"
        id="pricing-faq-title"
        title="Wait, what’s the catch?"
      >
        No mysterious asterisk. Just a few things worth knowing before you
        start.
      </SectionHeading>

      <Accordion className="bg-card mx-auto w-full max-w-3xl rounded-3xl border px-6">
        {FAQS.map(({ answer, question }) => (
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

    <section
      aria-labelledby="pricing-cta-title"
      className="container mx-auto px-4 pb-16 sm:px-6 sm:pb-24"
    >
      <div className="bg-card flex flex-col items-center gap-6 rounded-3xl border px-6 py-16 text-center">
        <h2
          className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl"
          id="pricing-cta-title"
        >
          No checkout. Just a starting point.
        </h2>
        <p className="text-muted-foreground max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
          Build something your people will want to come back to.
        </p>
        <MarketingActions
          className="justify-center"
          LinkComponent={RouterLink}
        />
        <a
          className="text-primary text-sm font-semibold underline-offset-4 hover:underline"
          href={LICENSE_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          Read the MIT licence
        </a>
      </div>
    </section>
  </div>
)
