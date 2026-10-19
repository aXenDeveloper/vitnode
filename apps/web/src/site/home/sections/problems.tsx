import { useTranslations } from 'use-intl'

import {
  MarketingSection,
  SectionHeading,
  TextLink,
} from '@/site/marketing/shared'

type ProblemKey =
  | 'fees'
  | 'languages'
  | 'moderation'
  | 'not_developer'
  | 'plumbing'
  | 'two_systems'

type ProblemTarget = { docs: string } | { page: '/compare' | '/plugins' }

const PROBLEMS: readonly { key: ProblemKey; target: ProblemTarget }[] = [
  { key: 'two_systems', target: { page: '/plugins' } },
  { key: 'moderation', target: { docs: 'dev/moderation' } },
  { key: 'languages', target: { docs: 'content-engine/localization' } },
  { key: 'fees', target: { page: '/compare' } },
  { key: 'plumbing', target: { docs: 'content-engine' } },
  { key: 'not_developer', target: { docs: 'dev/setup' } },
]

const ProblemLink = ({
  label,
  target,
}: {
  label: string
  target: ProblemTarget
}) =>
  'docs' in target ? (
    <TextLink params={{ _splat: target.docs }} to="/docs/$">
      {label}
    </TextLink>
  ) : (
    <TextLink to={target.page}>{label}</TextLink>
  )

export const ProblemsSection = () => {
  const t = useTranslations('site.home.problems')

  return (
    <div className="bg-muted/40 border-y">
      <MarketingSection labelledBy="problems-title">
        <SectionHeading
          eyebrow={t('eyebrow')}
          id="problems-title"
          title={t('title')}
        >
          {t('description')}
        </SectionHeading>

        <ol className="grid gap-x-10 gap-y-12 md:grid-cols-2">
          {PROBLEMS.map(({ key, target }, index) => (
            <li className="flex flex-col gap-4 border-t pt-6" key={key}>
              <span className="text-primary font-mono text-sm font-medium tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
                {t(`items.${key}.problem`)}
              </h3>
              <p className="text-muted-foreground leading-relaxed text-pretty">
                {t(`items.${key}.answer`)}
              </p>
              <ProblemLink label={t(`items.${key}.link`)} target={target} />
            </li>
          ))}
        </ol>
      </MarketingSection>
    </div>
  )
}
