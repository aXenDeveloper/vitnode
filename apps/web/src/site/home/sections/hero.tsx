import { Link } from '@tanstack/react-router'
import { buttonVariants } from '@vitnode/core/components/ui/button'
import { cn } from 'cn'
import { ArrowRight, Bot, CodeXml, Scale } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslations } from 'use-intl'

import { IslandsScene } from '@/site/home/illustrations/islands/islands-scene'
import { InstallCommand } from '@/site/marketing/install-command'
import { BUTTON } from '@/site/marketing/shared'

const TRUST = [
  { Icon: CodeXml, key: 'open_source' },
  { Icon: Scale, key: 'license' },
  { Icon: Bot, key: 'agents' },
] as const

const INTRO_KEY = 'vitnode-hero-intro'

const INTRO_SCRIPT = `try{if(sessionStorage.getItem('${INTRO_KEY}'))document.documentElement.dataset.heroSeen=''}catch{}`

const rise = (order: number) => ({ '--mk-n': order }) as React.CSSProperties

const useIntroOnce = () => {
  useEffect(() => {
    try {
      sessionStorage.setItem(INTRO_KEY, '1')
    } catch {
      return
    }

    const timer = window.setTimeout(() => {
      document.documentElement.dataset.heroSeen = ''
    }, 1500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [])
}

export const HeroSection = () => {
  const t = useTranslations('site.home.hero')
  useIntroOnce()

  return (
    <section
      aria-labelledby="hero-title"
      className="mk-isles-hero relative isolate -mt-14 overflow-hidden sm:-mt-16 lg:flex lg:min-h-svh lg:items-center"
    >
      <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
      <div aria-hidden className="mk-isles-sky" />
      <div className="container mx-auto grid items-center gap-8 px-4 pt-20 pb-12 sm:px-6 sm:pt-30 lg:grid-cols-2 lg:gap-10 lg:pt-24 lg:pb-8">
        <div className="relative z-10 flex min-w-0 flex-col gap-6">
          <h1
            className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl xl:text-6xl"
            id="hero-title"
          >
            <span className="mk-hero-rise block" style={rise(0)}>
              {t('title.lead')}
            </span>{' '}
            <span className="mk-hero-rise text-primary block" style={rise(1)}>
              {t('title.accent')}
            </span>
          </h1>

          <p
            className="mk-hero-rise text-muted-foreground max-w-xl text-base leading-relaxed text-pretty sm:text-lg"
            style={rise(2)}
          >
            {t('description')}
          </p>

          <div
            className="mk-hero-rise flex flex-wrap items-center gap-3"
            style={rise(3)}
          >
            <Link
              className={cn(buttonVariants({ size: 'lg' }), BUTTON, 'mk-press')}
              params={{ _splat: 'dev/setup' }}
              to="/docs/$"
            >
              {t('start')}
              <ArrowRight aria-hidden />
            </Link>
            <InstallCommand
              copiedLabel={t('copied')}
              copyLabel={t('copy_command')}
            />
          </div>

          <div className="mk-hero-rise" style={rise(4)}>
            <Link
              className="group text-primary inline-flex w-fit items-center gap-1 text-base font-medium underline-offset-4 hover:underline"
              to="/solutions"
            >
              {t('explore')}
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </div>

          <ul
            className="mk-hero-rise text-muted-foreground flex flex-wrap gap-x-6 gap-y-2 text-sm"
            style={rise(5)}
          >
            {TRUST.map(({ Icon, key }) => (
              <li className="flex items-center gap-2" key={key}>
                <Icon aria-hidden className="text-primary size-4 shrink-0" />
                {t(`trust.${key}`)}
              </li>
            ))}
          </ul>
        </div>

        <IslandsScene />
      </div>
    </section>
  )
}
