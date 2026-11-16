import { Link } from '@tanstack/react-router'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@vitnode/core/components/ui/accordion'
import { useTranslations } from 'use-intl'

import { LICENSE_URL } from '@/site/marketing/links'
import { MarketingSection, SectionHeading } from '@/site/marketing/shared'

const FAQ_ITEMS = [
  'what',
  'free',
  'ready',
  'non_dev',
  'hosting',
  'plugins',
  'languages',
  'ai',
] as const

const LINK = 'text-primary font-medium underline-offset-4 hover:underline'

const plainText = (chunks: string) => chunks

export const FaqSection = () => {
  const t = useTranslations('site.home.faq')

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((key) => ({
      '@type': 'Question',
      acceptedAnswer: {
        '@type': 'Answer',
        text: t.markup(`items.${key}.answer`, {
          code: plainText,
          create: plainText,
          license: plainText,
          setup: plainText,
        }),
      },
      name: t(`items.${key}.question`),
    })),
  }

  return (
    <MarketingSection id="faq" labelledBy="faq-title">
      <SectionHeading
        align="center"
        eyebrow={t('eyebrow')}
        id="faq-title"
        title={t('title')}
      />

      <Accordion
        className="bg-card mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border"
        defaultValue={[FAQ_ITEMS[0]]}
        hiddenUntilFound
      >
        {FAQ_ITEMS.map((key) => (
          <AccordionItem
            className="data-open:bg-muted/50 ease-fluid transition-[background-color] duration-300"
            key={key}
            value={key}
          >
            <AccordionTrigger className="hover:bg-muted/50 cursor-pointer touch-manipulation items-center gap-4 rounded-none px-5 py-4 text-base transition-[background-color] duration-150 focus-visible:ring-inset sm:px-6 sm:text-lg **:data-[slot=accordion-trigger-icon]:size-5">
              <span className="flex-1 text-pretty">
                {t(`items.${key}.question`)}
              </span>
            </AccordionTrigger>
            <AccordionContent className="ease-fluid text-muted-foreground in-data-ending-style:opacity-0 in-data-starting-style:translate-y-2 in-data-starting-style:opacity-0 max-w-prose px-5 pb-5 text-base leading-relaxed text-pretty transition-[opacity,translate] delay-75 duration-300 in-data-ending-style:delay-0 in-data-ending-style:duration-150 motion-reduce:transition-none sm:px-6 sm:pb-6">
              <p>
                {t.rich(`items.${key}.answer`, {
                  code: (chunks) => (
                    <code className="bg-muted text-foreground rounded px-1 py-0.5 font-mono text-sm">
                      {chunks}
                    </code>
                  ),
                  create: (chunks) => (
                    <Link
                      className={LINK}
                      params={{ _splat: 'dev/plugins/create' }}
                      to="/docs/$"
                    >
                      {chunks}
                    </Link>
                  ),
                  license: (chunks) => (
                    <a
                      className={LINK}
                      href={LICENSE_URL}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {chunks}
                    </a>
                  ),
                  setup: (chunks) => (
                    <Link
                      className={LINK}
                      params={{ _splat: 'dev/setup' }}
                      to="/docs/$"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <script
        // oxlint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replaceAll('<', '\\u003c'),
        }}
        type="application/ld+json"
      />
    </MarketingSection>
  )
}
