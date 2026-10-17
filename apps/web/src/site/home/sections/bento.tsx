import { cn } from 'cn'
import { useTranslations } from 'use-intl'

import { AiChipScene } from '@/site/home/illustrations/bento/ai-chip'
import { BoardScene } from '@/site/home/illustrations/bento/board'
import { CoTypeScene } from '@/site/home/illustrations/bento/co-type'
import { DropScene } from '@/site/home/illustrations/bento/drop'
import { SceneBackdrop } from '@/site/home/illustrations/bento/scene'
import { SuggestScene } from '@/site/home/illustrations/bento/suggest'
import { MarketingSection, SectionHeading } from '@/site/marketing/shared'

interface Tile {
  className?: string
  key: 'ai' | 'content' | 'live' | 'notifications' | 'search'
  Scene: React.ElementType
}

const TILES: readonly Tile[] = [
  { className: 'md:col-span-2', key: 'content', Scene: BoardScene },
  { key: 'notifications', Scene: DropScene },
  { key: 'live', Scene: CoTypeScene },
  { key: 'ai', Scene: AiChipScene },
  { key: 'search', Scene: SuggestScene },
]

export const BentoSection = () => {
  const t = useTranslations('site.home.bento')

  return (
    <MarketingSection id="features" labelledBy="features-title">
      <SectionHeading
        align="center"
        eyebrow={t('eyebrow')}
        id="features-title"
        title={t('title')}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TILES.map(({ className, key, Scene }) => (
          <article
            className={cn(
              'bg-card flex flex-col overflow-hidden rounded-2xl border',
              className,
            )}
            key={key}
          >
            <div
              aria-hidden
              className="relative isolate flex h-64 items-center justify-center-safe overflow-hidden px-6 pt-6"
              inert
            >
              <SceneBackdrop />
              <Scene />
            </div>
            <div className="flex flex-col gap-1 px-6 pt-4 pb-6">
              <h3 className="text-base font-semibold text-balance">
                {t(`${key}.title`)}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                {t(`${key}.desc`)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </MarketingSection>
  )
}
