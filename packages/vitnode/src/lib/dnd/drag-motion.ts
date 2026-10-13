import type {
  DropAnimation,
  DropAnimationKeyframeResolver,
} from "@dnd-kit/core";
import type { Transform } from "@dnd-kit/utilities";

import { defaultDropAnimationSideEffects } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export const DRAG_LIFT_SCALE = 1.03;

export const DRAG_LIFT_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

export const DRAG_LIFT_DURATION = 150;

const MAX_LIFT_TILT = 1.5;

const MIN_LIFT_TILT = 1;

const TILT_REFERENCE_WIDTH = 450;

export const liftTilt = (width: number): number =>
  width <= 0
    ? 0
    : Math.min(
        MAX_LIFT_TILT,
        Math.max(MIN_LIFT_TILT, TILT_REFERENCE_WIDTH / width),
      );

export const DRAG_SHIFT_TRANSITION = {
  duration: 600,
  easing:
    "linear(0, 0.063, 0.199, 0.357, 0.503, 0.636, 0.744, 0.827, 0.887, 0.932, 0.962, 0.982, 0.993, 1, 1.004, 1.005, 1.006, 1.005, 1.004, 1.003, 1.002, 1.002, 1.001, 1.001, 1)",
} as const;

interface Box {
  height: number;
  left: number;
  top: number;
  width: number;
}

const unliftedStart = (start: number, size: number, base: number): number =>
  start + (size - base) / 2;

export const settleTransform = ({
  base,
  initial,
  overlay,
  target,
}: {
  base?: { height: number; width: number };
  initial: Transform;
  overlay: Box;
  target: Box;
}): Transform => ({
  scaleX: 1 / DRAG_LIFT_SCALE,
  scaleY: 1 / DRAG_LIFT_SCALE,
  x:
    initial.x +
    target.left -
    unliftedStart(
      overlay.left,
      overlay.width,
      base?.width ?? overlay.width / DRAG_LIFT_SCALE,
    ),
  y:
    initial.y +
    target.top -
    unliftedStart(
      overlay.top,
      overlay.height,
      base?.height ?? overlay.height / DRAG_LIFT_SCALE,
    ),
});

const readLift = (overlay: HTMLElement) => {
  const lifted =
    overlay.querySelector<HTMLElement>("[data-drag-lift]") ?? overlay;
  const tilt = Number.parseFloat(getComputedStyle(lifted).rotate) || 0;

  return {
    base: { height: lifted.offsetHeight, width: lifted.offsetWidth },
    box: lifted.getBoundingClientRect(),
    tilt,
  };
};

const settleKeyframes: DropAnimationKeyframeResolver = ({
  active,
  dragOverlay,
  transform: { initial },
}) => {
  const { base, box, tilt } = readLift(dragOverlay.node);
  const settled = CSS.Transform.toString(
    settleTransform({ base, initial, overlay: box, target: active.rect }),
  );

  return [
    { transform: `${CSS.Transform.toString(initial)} rotate(0deg)` },
    { transform: `${settled} rotate(${-tilt}deg)` },
  ];
};

export const LIFTED_DROP_ANIMATION: DropAnimation = {
  duration: 250,
  easing: DRAG_LIFT_EASING,
  keyframes: settleKeyframes,
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0" } },
  }),
};

export const DRAG_OVERLAY_LIFT_CLASS =
  "border-primary/40 cursor-grabbing shadow-xl";
