import type { AnimationPlaybackControlsWithThen } from 'motion/react'

import { cn } from '@vitnode/core/lib/utils'
import { animate, motion, useMotionValue } from 'motion/react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

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

/**
 * A subscription that never fires, so the value below is read once per render.
 *
 * At module scope because `useSyncExternalStore` compares the subscribe
 * function by identity and re-subscribes when it changes - a new closure per
 * render would tear the store down and set it up again on every one.
 */
const neverChanges = () => () => {}

/**
 * `false` while the server renders and through hydration, `true` afterwards.
 *
 * `useSyncExternalStore`'s third argument is the server snapshot, which React
 * also uses for the client's *first* render - so the two agree and there is no
 * hydration mismatch, and the flag flips in the commit that follows.
 *
 * The point of asking is below: the marquee's second copy of its children is
 * scenery for an animation that cannot have started yet, and rendering it on
 * the server doubled this page's HTML.
 */
const useIsHydrated = () =>
  useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  )

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
  const isHydrated = useIsHydrated()
  const [currentSpeed, setCurrentSpeed] = useState(speed)
  const [ref, width] = useMeasuredWidth()
  const translation = useMotionValue(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [key, setKey] = useState(0)

  useEffect(() => {
    /*
     * Nothing to loop until the track is whole.
     *
     * The seam - the second, `inert` copy of the children - is rendered after
     * hydration, so before that the measured width is one copy and the distance
     * below would be half of half. Waiting is free: the loop is driven from this
     * effect, so there is no animation to interrupt, and the flag flips in the
     * commit right after hydration.
     */
    if (!isHydrated) return

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
  }, [key, translation, currentSpeed, width, gap, isTransitioning, isHydrated])

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

          It is rendered **after hydration only**, and that is a first-paint
          decision rather than a correctness one. Nothing needs the copy until
          the track starts moving, and the track is moved from an effect - so
          before hydration there is nothing for it to be the seam of. On
          vitnode.com's front page the children are six brand logotypes as inline
          SVG, which is 28 KB of markup: emitting them twice made the duplicate
          the single largest thing in the document, for a copy that is `inert`,
          off-screen and invisible until JavaScript runs.

          It cannot shift the layout when it arrives: the track is `w-max` inside
          an `overflow-hidden` frame, so the second copy extends it to the right,
          past the edge. `useMeasuredWidth` observes the track rather than
          measuring it once, so the width the loop is built from is the width
          *with* the copy, and the effect below re-runs when it changes.
        */}
        {isHydrated ? (
          <div className="contents" inert>
            {children}
          </div>
        ) : null}
      </motion.div>
    </div>
  )
}
