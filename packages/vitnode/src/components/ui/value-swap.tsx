import { cn } from "cn";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";

import { MotionFeatures } from "@/components/motion-features";

const EASE_FLUID = [0.22, 1, 0.36, 1] as const;
const ENTER_MS = 200;
const EXIT_MS = 150;
const TRAVEL_PX = 6;

const objectKeys = new WeakMap<object, number>();
let nextObjectKey = 0;

/** A stable string for any selected value: primitives by value, objects by identity. */
export const valueSwapKey = (value: unknown): string => {
  if (typeof value !== "object" || value === null) return String(value);
  let key = objectKeys.get(value);
  if (key === undefined) {
    key = nextObjectKey++;
    objectKeys.set(value, key);
  }

  return `object:${key}`;
};

/**
 * Plays the "new value" entrance on an element whose content was replaced in
 * place, such as an input's text after an option is picked. Skips the first
 * render and users who prefer reduced motion.
 */
export const useValueSwapEnter = (
  ref: React.RefObject<HTMLElement | null>,
  swapKey: string,
) => {
  const shouldReduceMotion = useReducedMotion();
  const previousKey = React.useRef(swapKey);

  React.useLayoutEffect(() => {
    if (previousKey.current === swapKey) return;
    previousKey.current = swapKey;
    if (shouldReduceMotion) return;
    ref.current?.animate(
      [
        {
          filter: "blur(2px)",
          opacity: 0,
          transform: `translateY(${TRAVEL_PX}px)`,
        },
        { filter: "blur(0)", opacity: 1, transform: "translateY(0)" },
      ],
      { duration: ENTER_MS, easing: `cubic-bezier(${EASE_FLUID.join(",")})` },
    );
  }, [ref, shouldReduceMotion, swapKey]);
};

/**
 * Cross-fades its children when `swapKey` changes: the old content rolls up
 * and out, the new one rolls in from below, and the width eases between the
 * two so a fitted trigger resizes smoothly. Nothing animates on first render
 * or for users who prefer reduced motion.
 */
export const ValueSwap = ({
  children,
  className,
  swapKey,
}: {
  children: React.ReactNode;
  className?: string;
  swapKey: string;
}) => {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = React.useRef<HTMLSpanElement>(null);
  const widthRef = React.useRef<null | number>(null);
  const keyRef = React.useRef(swapKey);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const nextWidth = container.getBoundingClientRect().width;
    const previousWidth = widthRef.current;
    widthRef.current = nextWidth;
    if (keyRef.current === swapKey) return;
    keyRef.current = swapKey;
    if (
      shouldReduceMotion ||
      previousWidth === null ||
      Math.abs(previousWidth - nextWidth) < 1
    ) {
      return;
    }
    container.dataset.swapping = "";
    const resize = container.animate(
      [{ width: `${previousWidth}px` }, { width: `${nextWidth}px` }],
      { duration: ENTER_MS, easing: `cubic-bezier(${EASE_FLUID.join(",")})` },
    );
    const settle = () => {
      delete container.dataset.swapping;
    };
    resize.addEventListener("finish", settle);
    resize.addEventListener("cancel", settle);
  }, [shouldReduceMotion, swapKey]);

  if (shouldReduceMotion) {
    return (
      <span className={cn("flex min-w-0 items-center", className)}>
        {children}
      </span>
    );
  }

  return (
    <MotionFeatures>
      <span
        className={cn(
          "group/value-swap relative flex max-w-full min-w-0 items-center overflow-hidden",
          className,
        )}
        data-slot="value-swap"
        ref={containerRef}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <m.span
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            className={
              typeof children === "string"
                ? "block min-w-0 truncate group-data-swapping/value-swap:text-clip"
                : "flex min-w-0 items-center gap-1.5"
            }
            exit={{
              filter: "blur(2px)",
              opacity: 0,
              transition: { duration: EXIT_MS / 1000, ease: EASE_FLUID },
              y: -TRAVEL_PX,
            }}
            initial={{ filter: "blur(2px)", opacity: 0, y: TRAVEL_PX }}
            key={swapKey}
            transition={{ duration: ENTER_MS / 1000, ease: EASE_FLUID }}
          >
            {children}
          </m.span>
        </AnimatePresence>
      </span>
    </MotionFeatures>
  );
};
