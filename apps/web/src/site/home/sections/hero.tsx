import { Link } from '@tanstack/react-router'
import { buttonVariants } from '@vitnode/core/components/ui/button'
import { cn } from 'cn'
import { ArrowRight, Bird, Bot, CodeXml, Scale } from 'lucide-react'
import { useTranslations } from 'use-intl'

import { HeroWall } from '@/site/home/illustrations/hero-wall/hero-wall'
import { BUTTON } from '@/site/marketing/shared'

const TRUST = [
  { Icon: CodeXml, key: 'open_source' },
  { Icon: Scale, key: 'license' },
  { Icon: Bot, key: 'agents' },
] as const

export const HeroSection = () => {
  const t = useTranslations('site.home.hero')

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate -mt-10 overflow-hidden"
    >
      <div className="container mx-auto grid items-center gap-10 px-4 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-2 lg:gap-6 lg:py-16">
        <div className="relative z-10 flex flex-col gap-6">
          <p className="bg-primary/10 text-primary inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
            <Bird aria-hidden className="size-3.5 shrink-0" />
            {t('canary')}
          </p>

          <h1
            className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
            id="hero-title"
          >
            {t.rich('title', {
              highlight: (chunks) => (
                <span className="text-primary">{chunks}</span>
              ),
            })}
          </h1>

          <p className="text-muted-foreground max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
            {t('description')}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              className={cn(buttonVariants({ size: 'lg' }), BUTTON)}
              to="/solutions"
            >
              {t('explore')}
              <ArrowRight aria-hidden />
            </Link>

            <a
              className={cn(
                buttonVariants({ size: 'lg', variant: 'outline' }),
                BUTTON,
              )}
              href="#admincp"
            >
              {t('see_product')}
            </a>
          </div>

          <ul className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {TRUST.map(({ Icon, key }) => (
              <li className="flex items-center gap-2" key={key}>
                <Icon aria-hidden className="text-primary size-4 shrink-0" />
                {t(`trust.${key}`)}
              </li>
            ))}
          </ul>
        </div>

        <HeroWall />
      </div>
    </section>
  )
}
