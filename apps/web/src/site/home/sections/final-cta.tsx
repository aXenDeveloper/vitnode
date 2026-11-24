import { Link } from '@tanstack/react-router'
import { buttonVariants } from '@vitnode/core/components/ui/button'
import { cn } from 'cn'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'use-intl'

import { InstallCommand } from '@/site/marketing/install-command'
import { ParallaxDust } from '@/site/marketing/parallax-dust'
import { REPOSITORY_URL } from '@/site/marketing/links'
import { BUTTON, GitHubIcon } from '@/site/marketing/shared'

export const FinalCtaSection = () => {
  const t = useTranslations('site.home')

  return (
    <section
      aria-labelledby="final-cta-title"
      className="mk-final-cta bg-background relative isolate mt-20 overflow-hidden"
    >
      <div
        aria-hidden
        className="mk-cta-field pointer-events-none absolute inset-0 isolate -z-10 overflow-hidden bg-blue-800"
      >
        <span className="mk-anim-cta-drift absolute -top-40 left-1/4 size-192 rounded-full bg-radial from-sky-500/80 to-transparent to-65%" />
        <span className="mk-anim-cta-drift-back absolute top-10 -right-40 size-176 rounded-full bg-radial from-blue-400 to-transparent to-65%" />
        <ParallaxDust tone="white" />
        <span className="absolute inset-0 bg-linear-to-r from-blue-950/80 via-blue-950/30 to-transparent" />
      </div>

      <div className="dark container mx-auto flex flex-col gap-6 px-4 pt-24 pb-48 sm:px-6 sm:pt-32">
        <h2
          className="max-w-xl text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl"
          id="final-cta-title"
        >
          {t('cta.title')}
        </h2>
        <p className="max-w-lg text-lg leading-relaxed text-pretty text-white/80">
          {t('cta.description')}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className={cn(
              buttonVariants({ size: 'lg' }),
              BUTTON,
              'mk-press bg-white text-blue-950 hover:bg-white/90',
            )}
            params={{ _splat: 'dev/setup' }}
            to="/docs/$"
          >
            {t('hero.start')}
            <ArrowRight aria-hidden />
          </Link>
          <a
            className={cn(
              buttonVariants({ size: 'lg', variant: 'outline' }),
              BUTTON,
              'mk-press border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white',
            )}
            href={REPOSITORY_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GitHubIcon />
            {t('cta.star')}
          </a>
          <InstallCommand
            className="border-white/20 bg-white/10 text-white [&_button]:text-white/70 [&_span]:text-white/60"
            copiedLabel={t('hero.copied')}
            copyLabel={t('hero.copy_command')}
          />
        </div>
      </div>
    </section>
  )
}
