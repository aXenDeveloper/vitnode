import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@vitnode/core/components/ui/accordion'
import { RouteMessages } from '@vitnode/core/tanstack/i18n'
import { RouterLink } from '@vitnode/core/tanstack/layout'
import { ArrowRight, Check, Coffee } from 'lucide-react'

import {
  CanaryNotice,
  MarketingActions,
  REPOSITORY_URL,
  SectionHeading,
} from './shared'

const faqs = [
  {
    question: 'Is VitNode actually free?',
    answer:
      'Yes. VitNode is open-source software under the MIT licence. There is no VitNode software subscription, per-member licence fee, or paid feature tier. You still pay for the infrastructure and services you choose.',
  },
  {
    question: 'Can I use it for my company or a client?',
    answer:
      'Yes. The MIT licence allows commercial use and modification. Keep the required copyright and licence notices when distributing the software. Your client project can be as serious as you like; our pricing page doesn’t have to be.',
  },
  {
    question: 'What will I need to pay for?',
    answer:
      'Your hosting, database, domain, and any storage, email, search, or AI services you select. Development and maintenance take time too. Costs depend on your setup and usage; VitNode does not bundle or bill for those services.',
  },
  {
    question: 'Does VitNode offer a managed cloud plan?',
    answer:
      'Not currently. You can deploy to your own cloud account using the Vercel guide, or self-host. A compatible server is needed for the built-in WebSocket server, local uploads, and in-process cron.',
  },
  {
    question: 'Is the canary ready for my live community?',
    answer:
      'Canary is a very early development build. Expect breaking changes, bugs, and unfinished features. Use it to explore and prototype, and assess its stability and security carefully before relying on it in production.',
  },
  {
    question: 'How can I support the project?',
    answer:
      'Try it, report a reproducible bug, improve the docs, or contribute a plugin. Share what you are building. Helpful feedback is a pretty good currency around here.',
  },
]

export const PricingBreadcrumb = () => (
  <RouteMessages>
    <span>Pricing</span>
  </RouteMessages>
)

export const PricingPage = () => (
  <div className="marketing" lang="en">
    <section
      className="marketing-shell pricing-hero"
      aria-labelledby="pricing-title"
    >
      <p className="eyebrow">Pricing. A very short negotiation.</p>
      <h1 id="pricing-title">
        Big community energy.
        <br />
        <span>Zero licence fees.</span>
      </h1>
      <p>
        One plan. The whole framework. No sales call standing between you and
        your next idea.
      </p>
      <span className="canary-pill">
        <Coffee size={16} aria-hidden /> Your coffee may cost more than our
        software.
      </span>
    </section>
    <section
      className="marketing-shell marketing-section"
      aria-label="VitNode pricing"
    >
      <div className="pricing-grid">
        <article className="pricing-card pricing-card-main">
          <span className="small-label">
            The open-source plan · MIT licence
          </span>
          <h2>The whole thing.</h2>
          <div className="price">
            $0 <span>/ software licence</span>
          </div>
          <p>
            For side projects, ambitious teams, and “what if we built…”
            conversations.
          </p>
          <ul className="check-list">
            {[
              'Full source code, yours to change',
              'Plugin system and Content Engine',
              'AdminCP, member roles, and staff permissions',
              'i18n, search, events, and caching tools',
              'AI integrations and real-time building blocks',
              'Commercial use and self-hosting',
            ].map((item) => (
              <li key={item}>
                <Check aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <MarketingActions LinkComponent={RouterLink} />
          <p className="quiet-note">
            Current canary features. Provider setup may be required. No managed
            hosting or support SLA included.
          </p>
        </article>
        <article className="pricing-card">
          <p className="eyebrow">The part where we’re honest</p>
          <h2>
            Servers still enjoy
            <br />
            being paid.
          </h2>
          <p>
            The framework is free. Running your community has its own costs.
          </p>
          <div className="pricing-costs">
            <div>
              <h3>A place to live</h3>
              <p>Hosting, a database, a domain, and backups.</p>
            </div>
            <div>
              <h3>The extras you choose</h3>
              <p>Email, storage, search services, and AI provider usage.</p>
            </div>
            <div>
              <h3>A little care and feeding</h3>
              <p>Your development time, updates, and ongoing maintenance.</p>
            </div>
          </div>
          <RouterLink
            href="/docs/dev/deployments/self-hosted"
            className="text-link"
          >
            Choose your setup <ArrowRight size={16} aria-hidden />
          </RouterLink>
        </article>
      </div>
      <CanaryNotice LinkComponent={RouterLink} />
    </section>
    <section
      className="marketing-shell marketing-section pricing-faq"
      aria-labelledby="pricing-faq-title"
    >
      <SectionHeading
        eyebrow="Very fair questions"
        title="Wait, what’s the catch?"
        id="pricing-faq-title"
      >
        No mysterious asterisk. Just a few things worth knowing.
      </SectionHeading>
      <Accordion>
        {faqs.map(({ question, answer }) => (
          <AccordionItem key={question}>
            <AccordionTrigger>{question}</AccordionTrigger>
            <AccordionContent>{answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
    <section className="marketing-shell marketing-section">
      <div className="final-cta">
        <h2>
          No checkout.
          <br />
          Just a starting point.
        </h2>
        <p>Build something your people will want to come back to.</p>
        <MarketingActions LinkComponent={RouterLink} />
        <a className="text-link" href={`${REPOSITORY_URL}/blob/canary/LICENSE`}>
          Read the MIT licence <ArrowRight size={16} aria-hidden />
        </a>
      </div>
    </section>
  </div>
)
