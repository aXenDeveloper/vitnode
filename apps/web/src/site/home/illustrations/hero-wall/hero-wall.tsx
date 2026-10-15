import { lazy, startTransition, Suspense, useEffect, useState } from 'react'

import { useScrollProgress } from '@/site/home/use-scroll-progress'

import { whenIdle } from './when-idle'

const HeroWallColumns = lazy(async () =>
  import('./hero-wall-columns').then((module) => ({
    default: module.HeroWallColumns,
  })),
)

export const HeroWall = () => {
  const ref = useScrollProgress<HTMLDivElement>(0.9)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(
    () =>
      whenIdle(() => {
        startTransition(() => {
          setIsMounted(true)
        })
      }),
    [],
  )

  return (
    <div
      aria-hidden
      className="relative -mx-4 h-112 mask-t-from-85% mask-b-from-80% select-none [--wall-scale:0.24] sm:-mx-6 sm:h-144 sm:[--wall-scale:0.3] lg:mr-[calc(50%-50vw)] lg:-ml-24 lg:h-176 lg:mask-l-from-58% lg:mask-l-to-88% lg:[--wall-scale:0.46]"
      inert
      ref={ref}
    >
      {isMounted ? (
        <Suspense fallback={null}>
          <div className="absolute inset-0" style={{ perspective: '1800px' }}>
            <HeroWallColumns />
          </div>
        </Suspense>
      ) : null}
    </div>
  )
}
