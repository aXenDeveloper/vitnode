import { cn } from '@vitnode/core/lib/utils'
import { useEffect, useRef, useSyncExternalStore } from 'react'

const neverChanges = () => () => {}

const useIsHydrated = () =>
  useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  )

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export interface InfiniteSliderProps {
  children: React.ReactNode
  className?: string
  gap?: number
  speed?: number
  speedOnHover?: number
}

export const InfiniteSlider = ({
  children,
  className,
  gap = 16,
  speed = 100,
  speedOnHover,
}: InfiniteSliderProps) => {
  const isHydrated = useIsHydrated()
  const trackRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<Animation | null>(null)

  useEffect(() => {
    const track = trackRef.current

    if (!isHydrated || !track || prefersReducedMotion()) return

    let animatedWidth = 0

    const restart = () => {
      const width = track.getBoundingClientRect().width

      if (width === 0 || width === animatedWidth) return

      animatedWidth = width
      animationRef.current?.cancel()

      const distance = (width + gap) / 2

      animationRef.current = track.animate(
        [
          { transform: 'translateX(0)' },
          { transform: `translateX(${-distance}px)` },
        ],
        {
          duration: (distance / speed) * 1000,
          easing: 'linear',
          iterations: Infinity,
        },
      )
    }

    restart()

    const observer = new ResizeObserver(restart)

    observer.observe(track)

    return () => {
      observer.disconnect()
      animationRef.current?.cancel()
      animationRef.current = null
    }
  }, [gap, isHydrated, speed])

  const setPlaybackRate = (rate: number) => {
    animationRef.current?.updatePlaybackRate(rate)
  }

  const hoverProps = speedOnHover
    ? {
        onPointerEnter: () => {
          setPlaybackRate(speedOnHover / speed)
        },
        onPointerLeave: () => {
          setPlaybackRate(1)
        },
      }
    : {}

  return (
    <div className={cn('overflow-hidden', className)}>
      <div
        className="flex w-max"
        ref={trackRef}
        style={{ gap: `${gap}px` }}
        {...hoverProps}
      >
        {children}

        {isHydrated ? (
          <div className="contents" inert>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  )
}
