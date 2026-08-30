import type { AnimationPlaybackControlsWithThen } from 'motion/react'

import { cn } from '@vitnode/core/lib/utils'
import { animate, motion, useMotionValue } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

/**
 * An element's width, kept current as it changes.
 *
 * The Next.js copy of this component used `react-use`'s `useMeasure`, and that
 * package is not a dependency of this application and is not worth becoming one
 * for a single `ResizeObserver`: it is a grab-bag of ~100 hooks, and the one
 * being borrowed is the eight lines below.
 *
 * A ref plus state rather than a callback ref, because the observer has to be
 * torn down as well as set up, and the width has to survive a re-render that
 * does not remount the node.
 */
const useMeasuredWidth = () => {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current

    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width)
    })

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  return [ref, width] as const
}

export interface InfiniteSliderProps {
  children: React.ReactNode
  className?: string
  gap?: number
  speed?: number
  speedOnHover?: number
}

/**
 * A row that scrolls forever, and slows down when a pointer is over it.
 *
 * Ported from the Next.js homepage rather than rewritten: same motion value,
 * same duplicated children, same linear loop, same two-phase hover handling
 * where a speed change animates out the remaining distance before the loop
 * restarts at the new rate. What changed is the measurement (see
 * {@link useMeasuredWidth}) and the horizontal-only signature - the vertical and
 * reversed directions were options nothing on this site ever passed.
 *
 * `w-max` on the moving track and `overflow-hidden` on the frame are what make
 * the loop seamless: the children are rendered twice, and the track is
 * translated by exactly half its own width before snapping back.
 */
export const InfiniteSlider = ({
  children,
  className,
  gap = 16,
  speed = 100,
  speedOnHover,
}: InfiniteSliderProps) => {
  const [currentSpeed, setCurrentSpeed] = useState(speed)
  const [ref, width] = useMeasuredWidth()
  const translation = useMotionValue(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [key, setKey] = useState(0)

  useEffect(() => {
    let controls: AnimationPlaybackControlsWithThen | undefined
    const to = -(width + gap) / 2

    if (isTransitioning) {
      controls = animate(translation, [translation.get(), to], {
        duration: Math.abs(translation.get() - to) / currentSpeed,
        ease: 'linear',
        onComplete: () => {
          setIsTransitioning(false)
          setKey((previous) => previous + 1)
        },
      })
    } else {
      controls = animate(translation, [0, to], {
        duration: Math.abs(to) / currentSpeed,
        ease: 'linear',
        onRepeat: () => {
          translation.set(0)
        },
        repeat: Infinity,
        repeatDelay: 0,
        repeatType: 'loop',
      })
    }

    return controls.stop
  }, [key, translation, currentSpeed, width, gap, isTransitioning])

  const hoverProps = speedOnHover
    ? {
        onHoverEnd: () => {
          setIsTransitioning(true)
          setCurrentSpeed(speed)
        },
        onHoverStart: () => {
          setIsTransitioning(true)
          setCurrentSpeed(speedOnHover)
        },
      }
    : {}

  return (
    <div className={cn('overflow-hidden', className)}>
      <motion.div
        className="flex w-max"
        ref={ref}
        style={{ gap: `${gap}px`, x: translation }}
        {...hoverProps}
      >
        {children}

        {/*
          The seam. The track is translated by exactly half its own width and
          snapped back, so the second copy is what is on screen while the first
          scrolls away - it is scenery, not content.

          `inert` is what keeps it scenery for everyone: without it a screen
          reader reads every logotype twice and a tab press lands on a link that
          is a duplicate of one just visited. `display: contents` is what lets
          the wrapper exist at all, because the track is a flex row with a `gap`
          and a real box here would collapse both copies into one item.
        */}
        <div className="contents" inert>
          {children}
        </div>
      </motion.div>
    </div>
  )
}
