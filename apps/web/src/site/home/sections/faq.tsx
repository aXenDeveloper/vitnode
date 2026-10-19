import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@vitnode/core/components/ui/accordion'
import { useTranslations } from 'use-intl'

import { HOME_FAQ_KEYS } from '@/site/home/home-head'
import { MarketingSection, SectionHeading } from '@/site/marketing/shared'

export const FaqSection = () => {
  const t = useTranslations('site.home.faq')

  return (
    <MarketingSection labelledBy="faq-title">
      <SectionHeading
        align="center"
        eyebrow={t('eyebrow')}
        id="faq-title"
        title={t('title')}
      />

      <Accordion className="bg-muted/60 mx-auto w-full max-w-3xl rounded-3xl px-6">
        {HOME_FAQ_KEYS.map((key) => (
          <AccordionItem key={key} value={key}>
            <AccordionTrigger className="text-base">
              {t(`items.${key}.question`)}
            </AccordionTrigger>
            <AccordionContent
              className="text-muted-foreground leading-relaxed text-pretty"
              hiddenUntilFound
            >
              {t(`items.${key}.answer`)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </MarketingSection>
  )
}
