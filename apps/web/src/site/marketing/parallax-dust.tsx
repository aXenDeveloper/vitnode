import { cn } from 'cn'
import { startTransition, useEffect, useRef, useState } from 'react'

import { whenIdle } from './when-idle'

const FINE_POINTER = '(hover: hover) and (pointer: fine)'
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const EASE = 0.08
const SETTLED = 0.002
const COUNT = 46

const PLANES = [
  { depth: 14, seed: 5, share: 0.4 },
  { depth: 30, seed: 25, share: 0.35 },
  { depth: 54, seed: 44, share: 0.25 },
]

const particles = (count: number, seed: number) =>
  Array.from({ length: count }, (_, raw) => {
    const index = raw + seed

    return {
      delay: ((index * 37) % 90) / 10,
      duration: 8 + ((index * 13) % 8),
      isLarge: index % 5 === 0,
      key: `${seed}-${raw}`,
      left: (index * 53) % 100,
      top: 12 + ((index * 29) % 84),
    }
  })

const usePointerParallax = (isMounted: boolean) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layer = ref.current
    const area = layer?.closest<HTMLElement>('section')

    if (!isMounted || !layer || !area) return

    const observer = new IntersectionObserver(([entry]) => {
      layer.toggleAttribute('data-paused', !entry?.isIntersecting)
    })

    observer.observe(layer)

    if (
      !window.matchMedia(FINE_POINTER).matches ||
      window.matchMedia(REDUCED_MOTION).matches
    ) {
      return () => {
        observer.disconnect()
      }
    }

    const planes = [...layer.querySelectorAll<HTMLElement>('[data-depth]')]
    const current = { x: 0, y: 0 }
    const target = { x: 0, y: 0 }
    let frame = 0

    const step = () => {
      current.x += (target.x - current.x) * EASE
      current.y += (target.y - current.y) * EASE

      for (const plane of planes) {
        const depth = Number(plane.dataset.depth)

        plane.style.transform = `translate3d(${current.x * depth}px, ${current.y * depth}px, 0)`
      }

      const isSettled =
        Math.abs(target.x - current.x) < SETTLED &&
        Math.abs(target.y - current.y) < SETTLED

      frame = isSettled ? 0 : requestAnimationFrame(step)
    }

    const move = (x: number, y: number) => {
      target.x = x
      target.y = y

      if (!frame) frame = requestAnimationFrame(step)
    }

    const handleMove = (event: PointerEvent) => {
      const bounds = layer.getBoundingClientRect()

      move(
        0.5 - (event.clientX - bounds.left) / bounds.width,
        0.5 - (event.clientY - bounds.top) / bounds.height,
      )
    }

    const handleLeave = () => {
      move(0, 0)
    }

    area.addEventListener('pointermove', handleMove)
    area.addEventListener('pointerleave', handleLeave)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      area.removeEventListener('pointermove', handleMove)
      area.removeEventListener('pointerleave', handleLeave)
    }
  }, [isMounted])

  return ref
}

export const ParallaxDust = ({
  className,
  tone = 'primary',
}: {
  className?: string
  tone?: 'primary' | 'white'
}) => {
  const [isMounted, setIsMounted] = useState(false)
  const ref = usePointerParallax(isMounted)

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
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 overflow-hidden',
        className,
      )}
      ref={ref}
    >
      {isMounted
        ? PLANES.map(({ depth, seed, share }, plane) => (
            <span
              className="absolute -inset-16 will-change-transform"
              data-depth={depth}
              key={depth}
            >
              {particles(Math.round(COUNT * share), seed).map(
                ({ delay, duration, isLarge, key, left, top }) => (
                  <span
                    className={cn(
                      'mk-anim-dust absolute rounded-full',
                      tone === 'white' ? 'bg-white' : 'bg-primary',
                      plane === 2 ? 'size-2' : isLarge ? 'size-1.5' : 'size-1',
                    )}
                    key={key}
                    style={
                      {
                        '--mk-delay': `${-delay}s`,
                        '--mk-duration': `${duration}s`,
                        left: `${left}%`,
                        top: `${top}%`,
                      } as React.CSSProperties
                    }
                  />
                ),
              )}
            </span>
          ))
        : null}
    </div>
  )
}
