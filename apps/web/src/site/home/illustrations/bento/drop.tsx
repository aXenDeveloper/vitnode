import { cn } from 'cn'
import { Bell, CheckCheck } from 'lucide-react'
import { useTranslations } from 'use-intl'

import { Fit, GridTexture } from '@/site/home/illustrations/bento/scene'
import { useLoopStep } from '@/site/home/illustrations/bento/use-loop-step'

const MESSAGES = [
  { avatar: 'K', key: 'reply', tone: 'bg-amber-400 text-amber-950' },
  { avatar: 'V', key: 'live', tone: 'bg-muted text-muted-foreground' },
  { avatar: 'O', key: 'comment', tone: 'bg-primary text-primary-foreground' },
  { avatar: 'M', key: 'report', tone: 'bg-muted text-muted-foreground' },
] as const

const DURATIONS = [1500, 1500, 1500, 1500, 2400] as const
const READ_STEP = 4

export const DropScene = () => {
  const t = useTranslations('site.home.bento.notifications')
  const { ref, step } = useLoopStep(DURATIONS)
  const arrived = Math.min(step + 1, MESSAGES.length)
  const read = step === READ_STEP
  const count = read ? 0 : arrived

  return (
    <div className="flex w-full justify-center" ref={ref}>
      <Fit height={232} width={360}>
        {MESSAGES.map(({ avatar, key, tone }, index) => {
          const depth = arrived - 1 - index
          const visible = depth >= 0 && depth <= 2
          const behind = depth > 0

          return (
            <span
              className="bg-card absolute left-1/2 flex w-80 items-center gap-3 rounded-2xl border p-3 shadow-lg transition-[transform,opacity] duration-500 ease-out motion-reduce:transition-none"
              key={key}
              style={{
                opacity: visible ? 1 - Math.max(depth, 0) * 0.28 : 0,
                top: 86,
                transform: `translateX(-50%) translateY(${depth < 0 ? -44 : depth * 11}px) scale(${depth < 0 ? 0.82 : 1 - depth * 0.05})`,
                transformOrigin: 'top center',
                zIndex: 10 - Math.max(depth, 0),
              }}
            >
              <span
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-3 transition-opacity duration-300',
                  behind ? 'opacity-0' : 'opacity-100',
                )}
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    tone,
                  )}
                >
                  {avatar}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs">
                  <span className="truncate font-semibold">
                    {t(`items.${key}.title`)}
                  </span>
                  <span className="text-muted-foreground truncate">
                    {t(`items.${key}.sub`)}
                  </span>
                </span>
              </span>
              <span
                className={cn(
                  'bg-primary size-2 shrink-0 rounded-full transition-opacity duration-300',
                  !read && depth >= 0 ? 'opacity-100' : 'opacity-0',
                )}
              />
            </span>
          )
        })}

        <span
          className="bg-card absolute left-1/2 z-20 flex size-16 -translate-x-1/2 items-center justify-center rounded-2xl border shadow-lg"
          style={{ top: 8 }}
        >
          <GridTexture className="inset-1.5" size={8} />
          <span className="bg-primary text-primary-foreground shadow-primary/30 relative flex size-9 items-center justify-center rounded-xl shadow-md">
            <Bell
              aria-hidden
              className={cn('size-4.5', !read && 'mk-anim-bento-swing')}
              key={count}
              strokeWidth={1.75}
            />
          </span>
          <span
            className={cn(
              'bg-primary text-primary-foreground ring-card absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums ring-2 transition-[transform,opacity] duration-300',
              count > 0 ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
            )}
          >
            {Math.max(count, 1)}
          </span>
        </span>

        <span
          className={cn(
            'absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap shadow-sm transition-colors duration-300',
            read
              ? 'bg-foreground text-background border-foreground'
              : 'bg-card text-foreground',
          )}
        >
          <CheckCheck aria-hidden className="size-3.5" />
          {t('mark_all')}
        </span>
      </Fit>
    </div>
  )
}
