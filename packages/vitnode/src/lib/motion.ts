import type { TargetAndTransition, Transition } from "motion/react";

export const SHAKE_KEYFRAMES = { x: [0, -8, 8, -6, 6, -3, 3, 0] };
export const SHAKE_TRANSITION = { duration: 0.4, ease: "easeInOut" as const };

export const REVEAL_HIDDEN = {
  height: 0,
  opacity: 0,
  y: -4,
  filter: "blur(2px)",
} satisfies TargetAndTransition;

export const REVEAL_SHOWN = {
  height: "auto",
  opacity: 1,
  y: 0,
  filter: "blur(0px)",
} satisfies TargetAndTransition;

export const REVEAL_TRANSITION = {
  height: { type: "spring", duration: 0.3, bounce: 0 },
  default: { duration: 0.2, ease: [0.32, 0.72, 0, 1] },
} satisfies Transition;

export const REVEAL_EXIT_TRANSITION = {
  height: { type: "spring", duration: 0.2, bounce: 0 },
  default: { duration: 0.15, ease: "easeIn" },
} satisfies Transition;

export interface MotionEnter {
  animate: TargetAndTransition;
  initial: TargetAndTransition;
  transition: Transition;
}

export const ENTER_EASE = [0.32, 0.72, 0, 1] as const;

export const BADGE_ENTER: MotionEnter = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  transition: { type: "spring", duration: 0.45, bounce: 0.2, delay: 0.06 },
};

export const COUNT_ENTER: MotionEnter = {
  initial: { opacity: 0, y: 10, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.35, ease: ENTER_EASE, delay: 0.2 },
};

export const staggeredEnter = (index: number): MotionEnter => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: ENTER_EASE, delay: 0.08 + index * 0.04 },
});
