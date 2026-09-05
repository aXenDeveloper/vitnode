import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@vitnode/core/components/ui/accordion'

import { SPONSOR_URL } from '#/site/marketing/links'
import { MarketingSection, SectionHeading } from '#/site/marketing/shared'

const FAQS: { answer: React.ReactNode; question: string }[] = [
  {
    answer:
      'A free, open-source framework for building community applications: members, roles, content, real-time updates, search and an Admin Control Panel come built in, and every feature you add ships as a plugin. Think of it as the foundation of a help center, a membership site or a project hub, minus the licence.',
    question: 'What is VitNode, in one breath?',
  },
  {
    answer:
      'Yes. VitNode is MIT-licensed. There is no subscription, no per-member fee and no paid tier hiding behind a sales call. You only pay for the infrastructure and services you choose to run it on.',
    question: 'Is it actually free?',
  },
  {
    answer:
      'Yes. The MIT licence allows commercial use, modification and redistribution. Keep the copyright and licence notice when you distribute the software, and build as serious a product as you like.',
    question: 'Can I use it for my company or a client project?',
  },
  {
    answer:
      'VitNode 2.0 is a very early canary build. Expect breaking changes, bugs and unfinished features. It is great for exploring, prototyping and shaping the roadmap, and not yet the place for a production community you cannot afford to break.',
    question: 'Is the canary ready for production?',
  },
  {
    answer:
      'Hosting, a PostgreSQL database, a domain and backups, plus any services you switch on: email delivery, file storage, a search cluster, AI provider usage. Deploy to your own cloud account with the Vercel guide or self-host on a server or in Docker.',
    question: 'What do I still pay for?',
  },
  {
    answer:
      'Not today. There is no managed VitNode cloud or support SLA. The docs cover self-hosting and cloud deployment step by step, and the community on GitHub is where questions land.',
    question: 'Do you offer managed hosting or support?',
  },
  {
    answer:
      'TypeScript end to end: React 19 with TanStack Start on the front, a Hono API, PostgreSQL through Drizzle ORM and Tailwind CSS for styling. Redis and Elasticsearch are optional when you grow.',
    question: 'Which stack is underneath?',
  },
  {
    answer:
      'Yes, on purpose. The repository ships an AGENTS.md with conventions, the entire documentation is available as one llms-full.txt, the API is typed end to end and exposes OpenAPI, and plugin boundaries keep an agent’s changes contained.',
    question: 'Can my AI coding agent work with it?',
  },
  {
    answer: (
      <>
        Try it, report a reproducible bug, improve the docs or build a plugin.
        If you would rather send coffee than code, donations through{' '}
        <a
          className="text-primary font-medium underline-offset-4 hover:underline"
          href={SPONSOR_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          GitHub Sponsors
        </a>{' '}
        keep the project independent and the maintainer awake. Stars are welcome
        too.
      </>
    ),
    question: 'How can I support the project?',
  },
]

export const FaqSection = () => (
  <MarketingSection id="faq" labelledBy="faq-title">
    <SectionHeading
      align="center"
      eyebrow="Very fair questions"
      id="faq-title"
      title="Wait, what’s the catch?"
    >
      No mysterious asterisk. Just the things people usually ask before they
      start.
    </SectionHeading>

    <Accordion className="bg-card mx-auto w-full max-w-3xl rounded-3xl border px-6">
      {FAQS.map(({ answer, question }) => (
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
