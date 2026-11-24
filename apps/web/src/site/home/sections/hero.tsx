import { Link } from '@tanstack/react-router'
import { buttonVariants } from '@vitnode/core/components/ui/button'
import { cn } from 'cn'
import { ArrowRight, Bot, CodeXml, Scale } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslations } from 'use-intl'

import { HeroWall } from '@/site/home/illustrations/hero-wall/hero-wall'
import { useWordRotation } from '@/site/home/use-word-rotation'
import { InstallCommand } from '@/site/marketing/install-command'
import { ParallaxDust } from '@/site/marketing/parallax-dust'
import { BUTTON } from '@/site/marketing/shared'

const TRUST = [
  { Icon: CodeXml, key: 'open_source' },
  { Icon: Scale, key: 'license' },
  { Icon: Bot, key: 'agents' },
] as const

const WORDS = ['forum', 'blog', 'shop', 'team', 'own'] as const

const HOLD_MS = 2200

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
  const { hoverProps, ref, state } = useWordRotation(WORDS.length, HOLD_MS)
  const { index, previous } = state

  useIntroOnce()

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate -mt-10 overflow-hidden"
    >
      <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
      <ParallaxDust className="mk-dust-fade" />
      <div
        className="container mx-auto grid items-center gap-10 px-4 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-2 lg:gap-6 lg:py-16"
        ref={ref}
      >
        <div className="relative z-10 flex flex-col gap-6">
          <h1
            className="text-4xl font-semibold tracking-tight sm:text-5xl xl:text-6xl"
            id="hero-title"
          >
            <span className="sr-only">{t('rotator.spoken')}</span>
            <span aria-hidden className="flex flex-col">
              <span className="mk-hero-rise" style={rise(0)}>
                {t('rotator.lead')}
              </span>
              <span
                className="mk-hero-rise text-primary -my-1 grid overflow-clip py-1"
                style={rise(1)}
                {...hoverProps}
              >
                {WORDS.map((word, wordIndex) => (
                  <span
                    className={cn(
                      'col-start-1 row-start-1',
                      wordIndex === index &&
                        previous !== null &&
                        'mk-hero-word-in',
                      wordIndex === previous && 'mk-hero-word-out',
                      wordIndex !== index &&
                        wordIndex !== previous &&
                        'invisible',
                    )}
                    key={
                      wordIndex === index || wordIndex === previous
                        ? `${word}-${index}`
                        : word
                    }
                  >
                    {t(`rotator.words.${word}`)}
                  </span>
                ))}
              </span>
              <span className="mk-hero-rise text-balance" style={rise(2)}>
                {t('rotator.tail')}
              </span>
            </span>
          </h1>

          <p
            className="mk-hero-rise text-muted-foreground max-w-xl text-base leading-relaxed text-pretty sm:text-lg"
            style={rise(3)}
          >
            {t('description')}
          </p>

          <div
            className="mk-hero-rise flex flex-wrap items-center gap-3"
            style={rise(4)}
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

          <div className="mk-hero-rise" style={rise(5)}>
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
            style={rise(6)}
          >
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
