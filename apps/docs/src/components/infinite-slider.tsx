"use client";

import { cn } from "@vitnode/core/lib/utils";
import {
  animate,
  type AnimationPlaybackControlsWithThen,
  motion,
  useMotionValue,
} from "motion/react";
import React from "react";
import { useMeasure } from "react-use";

export interface InfiniteSliderProps {
  children: React.ReactNode;
  className?: string;
  direction?: "horizontal" | "vertical";
  gap?: number;
  reverse?: boolean;
  speed?: number;
  speedOnHover?: number;
}

export function InfiniteSlider({
  children,
  gap = 16,
  speed = 100,
  speedOnHover,
  direction = "horizontal",
  reverse = false,
  className,
}: InfiniteSliderProps) {
  // eslint-disable-next-line @eslint-react/no-unused-state
  const [currentSpeed, setCurrentSpeed] = React.useState(speed);
  const [ref, { width, height }] = useMeasure<HTMLDivElement>();
  const translation = useMotionValue(0);
  // eslint-disable-next-line @eslint-react/no-unused-state
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  // eslint-disable-next-line @eslint-react/no-unused-state
  const [key, setKey] = React.useState(0);

  React.useEffect(() => {
    let controls: AnimationPlaybackControlsWithThen | undefined;
    const size = direction === "horizontal" ? width : height;
    const contentSize = size + gap;
    const from = reverse ? -contentSize / 2 : 0;
    const to = reverse ? 0 : -contentSize / 2;

    const distanceToTravel = Math.abs(to - from);
    const duration = distanceToTravel / currentSpeed;

    if (isTransitioning) {
      const remainingDistance = Math.abs(translation.get() - to);
      const transitionDuration = remainingDistance / currentSpeed;

      controls = animate(translation, [translation.get(), to], {
        ease: "linear",
        duration: transitionDuration,
        onComplete: () => {
          setIsTransitioning(false);
          setKey(prevKey => prevKey + 1);
        },
      });
    } else {
      controls = animate(translation, [from, to], {
        ease: "linear",
        duration: duration,
        repeat: Infinity,
        repeatType: "loop",
        repeatDelay: 0,
        onRepeat: () => {
          translation.set(from);
        },
      });
    }

    return controls?.stop;
  }, [
    key,
    translation,
    currentSpeed,
    width,
    height,
    gap,
    isTransitioning,
    direction,
    reverse,
  ]);

  const hoverProps = speedOnHover
    ? {
        onHoverStart: () => {
          setIsTransitioning(true);
          setCurrentSpeed(speedOnHover);
        },
        onHoverEnd: () => {
          setIsTransitioning(true);
          setCurrentSpeed(speed);
        },
      }
    : {};

  return (
    <div className={cn("overflow-hidden", className)}>
      <motion.div
        className="flex w-max"
        ref={ref}
        style={{
          ...(direction === "horizontal"
            ? { x: translation }
            : { y: translation }),
          gap: `${gap}px`,
          flexDirection: direction === "horizontal" ? "row" : "column",
        }}
        {...hoverProps}
      >
        {children}
        {children}
      </motion.div>
    </div>
  );
}
