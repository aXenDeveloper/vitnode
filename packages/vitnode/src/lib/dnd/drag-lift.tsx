import type { ReactElement, ReactNode } from "react";

import { useReducedMotion } from "motion/react";
import React from "react";

import {
  DRAG_LIFT_DURATION,
  DRAG_LIFT_EASING,
  DRAG_LIFT_SCALE,
  liftTilt,
} from "./drag-motion";

export const DragLift = ({
  children,
}: {
  children: ReactNode;
}): ReactElement => {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const tilt = reduceMotion ? 0 : liftTilt(element.offsetWidth);
    element.style.rotate = `${tilt}deg`;
    if (reduceMotion) return;

    const lift = element.animate(
      [
        { rotate: "0deg", scale: "1" },
        { rotate: `${tilt}deg`, scale: String(DRAG_LIFT_SCALE) },
      ],
      { duration: DRAG_LIFT_DURATION, easing: DRAG_LIFT_EASING },
    );

    return () => {
      lift.cancel();
    };
  }, [reduceMotion]);

  return (
    <div
      className="size-full"
      data-drag-lift
      ref={ref}
      style={{ scale: String(DRAG_LIFT_SCALE) }}
    >
      {children}
    </div>
  );
};
