import type {
  DropAnimation,
  DropAnimationKeyframeResolver,
} from "@dnd-kit/core";
import type { Transform } from "@dnd-kit/utilities";

import { defaultDropAnimationSideEffects } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export const DRAG_LIFT_SCALE = 1.02;

export const DRAG_SHIFT_TRANSITION = {
  duration: 200,
  easing: "cubic-bezier(0.455, 0.03, 0.515, 0.955)",
} as const;

interface Box {
  height: number;
  left: number;
  top: number;
  width: number;
}

const unliftedStart = (start: number, size: number): number =>
  start + (size - size / DRAG_LIFT_SCALE) / 2;

export const settleTransform = ({
  initial,
  overlay,
  target,
}: {
  initial: Transform;
  overlay: Box;
  target: Box;
}): Transform => ({
  scaleX: 1 / DRAG_LIFT_SCALE,
  scaleY: 1 / DRAG_LIFT_SCALE,
  x: initial.x + target.left - unliftedStart(overlay.left, overlay.width),
  y: initial.y + target.top - unliftedStart(overlay.top, overlay.height),
});

const settleKeyframes: DropAnimationKeyframeResolver = ({
  active,
  dragOverlay,
  transform: { initial },
}) => [
  { transform: CSS.Transform.toString(initial) },
  {
    transform: CSS.Transform.toString(
      settleTransform({
        initial,
        overlay: dragOverlay.rect,
        target: active.rect,
      }),
    ),
  },
];

export const LIFTED_DROP_ANIMATION: DropAnimation = {
  duration: 200,
  easing: "cubic-bezier(0.23, 1, 0.32, 1)",
  keyframes: settleKeyframes,
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0" } },
  }),
};

export const DRAG_OVERLAY_LIFT_CLASS =
  "border-primary/40 cursor-grabbing shadow-xl animate-in zoom-in-98 duration-150 ease-out motion-reduce:animate-none";

export const DRAG_OVERLAY_LIFT_STYLE = { scale: String(DRAG_LIFT_SCALE) };
