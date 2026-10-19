import { Link } from '@tanstack/react-router'
import { buttonVariants } from '@vitnode/core/components/ui/button'
import { cn } from 'cn'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'use-intl'

import { REPOSITORY_URL } from '@/site/marketing/links'
import { BUTTON, GitHubIcon, TextLink } from '@/site/marketing/shared'

export const CtaSection = () => {
  const t = useTranslations('site.home.cta')

  return (
    <section
      aria-labelledby="cta-title"
      className="container mx-auto px-4 pb-16 sm:px-6 sm:pb-24"
    >
      <div className="bg-muted/60 flex flex-col items-center gap-6 rounded-3xl px-6 py-16 text-center">
        <h2
          className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl"
          id="cta-title"
        >
          {t('title')}
        </h2>
        <p className="text-muted-foreground max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
          {t('description')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            className={cn(buttonVariants({ size: 'lg' }), BUTTON)}
            params={{ _splat: 'dev/setup' }}
            to="/docs/$"
          >
            {t('start')}
            <ArrowRight aria-hidden />
          </Link>
          <a
            className={cn(
              buttonVariants({ size: 'lg', variant: 'outline' }),
              BUTTON,
            )}
            href={REPOSITORY_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GitHubIcon />
            {t('github')}
          </a>
        </div>
        <TextLink to="/solutions">{t('solutions')}</TextLink>
      </div>
    </section>
  )
}
