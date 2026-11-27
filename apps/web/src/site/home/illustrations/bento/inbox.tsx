import { Badge } from '@vitnode/core/components/ui/badge'
import { cn } from 'cn'
import {
  AtSign,
  CheckCheck,
  MessageCircle,
  Reply,
  SlidersHorizontal,
} from 'lucide-react'
import { useTranslations } from 'use-intl'

import {
  Fit,
  MEMBER_TONE,
  SceneAvatar,
} from '@/site/home/illustrations/bento/scene'
import { useLoopStep } from '@/site/home/illustrations/bento/use-loop-step'

const DURATIONS = [350, 1500, 700, 1500, 3200] as const
const PRESS_STEP = 0
const READ_STEP = 1
const RESET_STEP = 2
const STRIDE = 52

const ITEMS = [
  { from: 4, Icon: Reply, key: 'reply', member: 'kuba' },
  { from: 3, Icon: MessageCircle, key: 'comment', member: 'ola' },
  { from: 0, Icon: AtSign, key: 'mention', member: 'marta' },
] as const

const TABS = ['unread', 'mentions', 'all'] as const

export const InboxScene = () => {
  const t = useTranslations('site.home.bento.notifications')
  const { ref, step } = useLoopStep(DURATIONS)
  const present = (from: number) =>
    from === 0 || step >= from || step === PRESS_STEP || step === READ_STEP
  const visible = ITEMS.filter((item) => present(item.from))
  const cleared = step === READ_STEP || step === RESET_STEP
  const count = cleared ? 0 : visible.length - 1

  return (
    <div className="flex w-full justify-center" ref={ref}>
      <Fit height={232} width={340}>
        <span className="bg-muted absolute inset-x-2 top-1 flex flex-col gap-1.5 overflow-hidden rounded-xl border p-1.5 shadow-lg">
          <span className="flex h-6 items-center justify-between px-1.5">
            <span className="text-sm font-medium">{t('heading')}</span>
            <SlidersHorizontal
              aria-hidden
              className="text-muted-foreground size-3.5"
            />
          </span>

          <span className="flex h-7 gap-0.5">
            {TABS.map((tab, index) => (
              <span
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent text-xs font-medium',
                  index === 0
                    ? 'bg-card border-border shadow-xs'
                    : 'text-muted-foreground',
                )}
                key={tab}
              >
                <span className="relative">
                  {t(`tabs.${tab}`)}
                  {index === 0 ? (
                    <Badge
                      className={cn(
                        'absolute top-1/2 left-full ml-1.5 h-4 -translate-y-1/2 px-1.5 transition-opacity duration-200 motion-reduce:transition-none',
                        count > 0 ? 'opacity-100' : 'opacity-0',
                      )}
                      variant="secondary"
                    >
                      {Math.max(count, 1)}
                    </Badge>
                  ) : null}
                </span>
              </span>
            ))}
          </span>

          <span className="bg-card relative h-27 overflow-hidden rounded-lg border">
            {ITEMS.map(({ from, Icon, key, member }) => {
              const slot = visible.findIndex((item) => item.key === key)
              const shown = slot !== -1
              const unread = from > 0 && shown && !cleared

              return (
                <span
                  className={cn(
                    'bg-muted/70 absolute inset-x-1 top-1 flex h-12 items-center gap-2.5 rounded-md px-2 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
                    shown ? 'opacity-100' : 'opacity-0 duration-200',
                  )}
                  key={key}
                  style={{
                    transform: `translateY(${(shown ? slot : -0.6) * STRIDE}px)`,
                  }}
                >
                  <span className="relative shrink-0">
                    <SceneAvatar
                      className={cn('size-7 text-xs', MEMBER_TONE[member])}
                      initial={t(`items.${key}.who`).charAt(0)}
                    />
                    <span className="bg-primary text-primary-foreground ring-card absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full ring-2">
                      <Icon aria-hidden className="size-2" strokeWidth={3} />
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col text-xs leading-snug">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate">
                        <span className="font-semibold">
                          {t(`items.${key}.who`)}
                        </span>{' '}
                        {t(`items.${key}.action`)}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {t(`items.${key}.time`)}
                      </span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">
                        {t(`items.${key}.target`)}
                      </span>
                      <span
                        className={cn(
                          'bg-primary size-2 shrink-0 rounded-full transition-opacity duration-300 motion-reduce:transition-none',
                          unread ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </span>
                  </span>
                </span>
              )
            })}
          </span>

          <span className="flex h-6 items-center justify-end">
            <span
              className={cn(
                'flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-[transform,background-color] duration-150 ease-out motion-reduce:transition-none',
                step === PRESS_STEP ? 'bg-card scale-96' : 'bg-transparent',
              )}
            >
              <CheckCheck aria-hidden className="size-3.5" />
              {t('mark_all')}
            </span>
          </span>
        </span>
      </Fit>
    </div>
  )
}
