import { buttonVariants } from '@vitnode/core/components/ui/button'
import { cn } from 'cn'
import { ArrowLeft, ChevronDown, Languages, Save } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'use-intl'

import {
  Fit,
  MEMBER_TONE,
  SceneAvatar,
} from '@/site/home/illustrations/bento/scene'

const CYCLE = 9000
const FADE_AT = 7600
const IDLE_AFTER = 450
const SELECT_FROM = 3400
const SELECT_TO = 3800
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

const jitter = (index: number, seed: number) => {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453

  return value - Math.floor(value)
}

const schedule = (
  text: string,
  {
    base,
    seed,
    spread,
    startAt,
  }: { base: number; seed: number; spread: number; startAt: number },
) => {
  const times: number[] = []
  let at = startAt

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    at += base + jitter(index, seed) * spread
    if (char === ' ') at += 40
    if (char === '.' || char === ',') at += 160
    times.push(at)
  }

  return times
}

const countAt = (times: readonly number[], t: number) => {
  let count = 0

  while (count < times.length && times[count] <= t) count += 1

  return count
}

const isIdle = (times: readonly number[], count: number, t: number) =>
  count === 0 || t - times[count - 1] > IDLE_AFTER

const useAnimationClock = (cycle: number, still: number) => {
  const ref = useRef<HTMLDivElement>(null)
  const [t, setT] = useState(still)

  useEffect(() => {
    const node = ref.current

    if (!node || window.matchMedia(REDUCED_MOTION).matches) return

    let frame = 0
    let origin = 0
    let elapsed = 0

    const tick = (now: number) => {
      if (!origin) origin = now - elapsed
      setT((now - origin) % cycle)
      frame = requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        if (!frame) frame = requestAnimationFrame(tick)

        return
      }

      if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
        elapsed = performance.now() - origin
        origin = 0
      }
    })

    observer.observe(node)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [cycle])

  return { ref, t }
}

const Caret = ({
  className,
  idle,
  name,
}: {
  className: string
  idle: boolean
  name: string
}) => (
  <span className="relative inline-block h-4 w-px align-middle">
    <span
      className={cn('absolute inset-0', className, idle && 'mk-anim-blink')}
    />
    <span
      className={cn(
        'absolute -top-4 left-0 rounded-sm px-1 text-xs leading-4 font-semibold whitespace-nowrap',
        className,
      )}
    >
      {name}
    </span>
  </span>
)

export const EditorScene = () => {
  const t = useTranslations('site.home.bento.live')
  const olaText = t('ola')
  const kubaText = t('kuba')
  const olaTimes = useMemo(
    () => schedule(olaText, { base: 46, seed: 1, spread: 50, startAt: 500 }),
    [olaText],
  )
  const kubaTimes = useMemo(
    () => schedule(kubaText, { base: 40, seed: 2, spread: 44, startAt: 1500 }),
    [kubaText],
  )
  const { ref, t: time } = useAnimationClock(CYCLE, FADE_AT - 1)
  const ola = countAt(olaTimes, time)
  const kuba = countAt(kubaTimes, time)
  const olaIdle = isIdle(olaTimes, ola, time)
  const kubaIdle = isIdle(kubaTimes, kuba, time)
  const selection = Math.min(
    1,
    Math.max(0, (time - SELECT_FROM) / (SELECT_TO - SELECT_FROM)),
  )
  const fading = time >= FADE_AT
  const saving = !fading && (!olaIdle || !kubaIdle)

  return (
    <div className="flex w-full justify-center" ref={ref}>
      <Fit height={232} width={340}>
        <span className="bg-card absolute inset-x-2 inset-y-1 flex flex-col overflow-hidden rounded-xl border shadow-lg">
          <span className="flex items-center justify-between gap-2 border-b px-2 py-1.5">
            <span className="flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center">
                <ArrowLeft aria-hidden className="size-3.5" />
              </span>
              <span
                className={cn(
                  buttonVariants({ size: 'sm', variant: 'outline' }),
                  'h-6 gap-1.5 px-2 text-xs',
                )}
              >
                <Languages aria-hidden className="size-3.5" />
                {t('translate')}
              </span>
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex shrink-0">
                <SceneAvatar
                  className={cn(
                    'ring-card size-5 text-xs ring-2',
                    MEMBER_TONE.ola,
                  )}
                  initial="O"
                />
                <SceneAvatar
                  className={cn(
                    'ring-card -ml-1.5 size-5 text-xs ring-2',
                    MEMBER_TONE.kuba,
                  )}
                  initial="K"
                />
              </span>
              <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full transition-colors duration-200',
                    saving ? 'bg-amber-500' : 'bg-success',
                  )}
                />
                <span className="truncate">
                  {saving ? t('saving') : t('saved')}
                </span>
              </span>
              <span className="flex shrink-0">
                <span
                  className={cn(
                    buttonVariants({ size: 'sm' }),
                    'h-6 rounded-r-none px-1.5',
                  )}
                >
                  <Save aria-hidden className="size-3.5" />
                </span>
                <span
                  className={cn(
                    buttonVariants({ size: 'sm' }),
                    'border-l-primary-foreground/25 h-6 rounded-l-none px-1',
                  )}
                >
                  <ChevronDown aria-hidden className="size-3.5" />
                </span>
              </span>
            </span>
          </span>
          <span className="flex flex-col gap-1.5 px-4 pt-3 pb-4">
            <span className="truncate text-base font-semibold tracking-tight">
              {t('heading')}
            </span>
            <span className="flex flex-col gap-1 text-sm leading-7">
              <span>
                {t('first')}{' '}
                <span className="relative">
                  <span
                    className={cn(
                      'bg-primary/20 absolute -inset-x-0.5 inset-y-1 origin-left rounded-sm transition-opacity duration-300',
                      fading ? 'opacity-0' : 'opacity-100',
                    )}
                    style={{ transform: `scaleX(${selection})` }}
                  />
                  <span className="relative">{t('selected')}</span>
                </span>
                {t('first_end')}
                <span
                  className={cn(
                    'transition-opacity duration-500',
                    fading ? 'opacity-0' : 'opacity-100',
                  )}
                >
                  {olaText.slice(0, ola)}
                </span>
                <Caret className={MEMBER_TONE.ola} idle={olaIdle} name="Ola" />
                <span aria-hidden className="text-transparent">
                  {olaText.slice(ola)}
                </span>
              </span>
              <span>
                {t('second')}
                <span
                  className={cn(
                    'transition-opacity duration-500',
                    fading ? 'opacity-0' : 'opacity-100',
                  )}
                >
                  {kubaText.slice(0, kuba)}
                </span>
                <Caret
                  className={MEMBER_TONE.kuba}
                  idle={kubaIdle}
                  name="Kuba"
                />
                <span aria-hidden className="text-transparent">
                  {kubaText.slice(kuba)}
                </span>
              </span>
            </span>
          </span>
        </span>
      </Fit>
    </div>
  )
}
