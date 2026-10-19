import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'use-intl'

import { COMPARE_SLUGS, compareEntry } from '@/site/compare/catalog'
import {
  MarketingSection,
  SectionHeading,
  TextLink,
} from '@/site/marketing/shared'

export const AlternativesSection = () => {
  const t = useTranslations('site.home.alternatives')

  return (
    <MarketingSection labelledBy="alternatives-title">
      <SectionHeading
        eyebrow={t('eyebrow')}
        id="alternatives-title"
        title={t('title')}
      >
        {t('description')}
      </SectionHeading>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {COMPARE_SLUGS.map((slug) => {
          const { name } = compareEntry(slug)

          return (
            <li key={slug}>
              <Link
                className="group bg-card hover:border-primary/40 flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 transition-colors"
                params={{ slug }}
                to="/compare/$slug"
              >
                <span className="font-medium">{t('item', { name })}</span>
                <ArrowRight
                  aria-hidden
                  className="text-primary size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          )
        })}
      </ul>

      <TextLink to="/compare">{t('all')}</TextLink>
    </MarketingSection>
  )
}
