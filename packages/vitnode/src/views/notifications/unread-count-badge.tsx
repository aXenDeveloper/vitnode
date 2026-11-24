import { cn } from "cn";
import { AnimatePresence, useAnimate, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";

import { MotionFeatures } from "@/components/motion-features";
import { SlidingNumber } from "@/components/ui/sliding-number";

const MAX_SHOWN = 99;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const ENTER_TRANSITION = {
  type: "spring",
  duration: 0.4,
  bounce: 0.3,
} as const;
const EXIT = {
  opacity: 0,
  scale: 0.6,
  transition: { duration: 0.15, ease: EASE_IN },
};
const INSTANT = { duration: 0 };

/**
 * An unread count that pops in when it first becomes non-zero, rolls its
 * digits as it changes, pulses when it grows and shrinks away at zero. Shows
 * `99+` above 99. Static when the user prefers reduced motion.
 */
export const UnreadCountBadge = ({
  className,
  count,
  testId,
}: {
  className?: string;
  count: number;
  testId?: string;
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const previousCount = React.useRef(count);

  React.useEffect(() => {
    const previous = previousCount.current;
    previousCount.current = count;
    if (shouldReduceMotion || previous === 0 || count <= previous) return;
    if (!scope.current) return;

    void animate(
      scope.current,
      { scale: [1, 1.2, 1] },
      { duration: 0.35, ease: EASE_OUT },
    );
  }, [animate, count, scope, shouldReduceMotion]);

  return (
    <MotionFeatures>
      <AnimatePresence initial={false}>
        {count > 0 ? (
          <m.span
            animate={{ opacity: 1, scale: 1 }}
            aria-hidden
            className={cn("inline-flex items-center justify-center", className)}
            data-testid={testId}
            exit={
              shouldReduceMotion ? { opacity: 0, transition: INSTANT } : EXIT
            }
            initial={{ opacity: 0, scale: 0.6 }}
            key="badge"
            ref={scope}
            transition={shouldReduceMotion ? INSTANT : ENTER_TRANSITION}
          >
            <SlidingNumber value={Math.min(count, MAX_SHOWN)} />
            {count > MAX_SHOWN ? "+" : null}
          </m.span>
        ) : null}
      </AnimatePresence>
    </MotionFeatures>
  );
};
