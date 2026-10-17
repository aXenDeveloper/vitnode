import { cn } from 'cn'
import { Bold, Italic, Link2, Underline } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'use-intl'

import { Fit } from '@/site/home/illustrations/bento/scene'

const CYCLE = 9000
const FADE_AT = 7600
const IDLE_AFTER = 450
const SELECT_FROM = 3400
const SELECT_TO = 3800
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

const OLA = 'bg-primary text-primary-foreground'
const KUBA = 'bg-amber-400 text-amber-950'

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
    const char = text[index] ?? ''
    at += base + jitter(index, seed) * spread
    if (char === ' ') at += 40
    if (char === '.' || char === ',') at += 160
    times.push(at)
  }

  return times
}

const countAt = (times: readonly number[], t: number) => {
  let count = 0

  while (count < times.length && (times[count] ?? Infinity) <= t) count += 1

  return count
}

const isIdle = (times: readonly number[], count: number, t: number) =>
  count === 0 || t - (times[count - 1] ?? 0) > IDLE_AFTER

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

const Initial = ({
  className,
  initials,
}: {
  className: string
  initials: string
}) => (
  <span
    className={cn(
      'ring-card flex size-6 items-center justify-center rounded-full text-xs font-semibold ring-2',
      className,
    )}
  >
    {initials}
  </span>
)

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

export const CoTypeScene = () => {
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
        <span className="bg-card absolute inset-x-2 inset-y-1 flex flex-col overflow-hidden rounded-2xl border shadow-lg">
          <span className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-muted-foreground flex items-center gap-2.5">
              <Bold aria-hidden className="size-3.5" />
              <Italic aria-hidden className="size-3.5" />
              <Underline aria-hidden className="size-3.5" />
              <Link2 aria-hidden className="size-3.5" />
            </span>
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {saving ? t('saving') : t('saved')}
              </span>
              <span className="flex">
                <Initial className={OLA} initials="O" />
                <Initial className={cn(KUBA, '-ml-1.5')} initials="K" />
                <Initial
                  className="bg-muted text-muted-foreground -ml-1.5"
                  initials="Y"
                />
              </span>
            </span>
          </span>
          <span className="flex flex-col gap-2 p-4 pt-5 text-sm leading-8">
            <span>
              {t('first')}{' '}
              <span className="relative">
                <span
                  className={cn(
                    'bg-foreground/10 absolute -inset-x-0.5 inset-y-1 origin-left rounded-sm transition-opacity duration-300',
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
              <Caret className={OLA} idle={olaIdle} name="Ola" />
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
              <Caret className={KUBA} idle={kubaIdle} name="Kuba" />
              <span aria-hidden className="text-transparent">
                {kubaText.slice(kuba)}
              </span>
            </span>
            <span className="bg-muted-foreground/20 h-1.5 w-3/4 rounded-full" />
          </span>
        </span>
      </Fit>
    </div>
  )
}
