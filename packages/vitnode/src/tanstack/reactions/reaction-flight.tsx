import { animate } from "motion/react";
import React from "react";
import { createPortal } from "react-dom";

import type { ReactionLook } from "./reaction-icon";

import { ReactionIcon } from "./reaction-icon";

export interface ReactionFlightPlan {
  code: string;
  from: DOMRect;
  id: number;
}

const FLIGHT = { duration: 0.32, ease: [0.32, 0.72, 0, 1] } as const;
const TARGET_TIMEOUT_MS = 800;

export const REACTION_ICON_ATTRIBUTE = "data-reaction-icon";

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const popReactionIcon = (element: HTMLElement | null) => {
  if (prefersReducedMotion()) return;
  element?.animate(
    [
      { transform: "scale(1)" },
      { offset: 0.35, transform: "scale(1.35)" },
      { transform: "scale(1)" },
    ],
    { duration: 380, easing: "cubic-bezier(0.32, 0.72, 0, 1)" },
  );
};

const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

export const ReactionFlight = ({
  flight,
  list,
  onLand,
  reaction,
}: {
  flight: ReactionFlightPlan;
  list: React.RefObject<HTMLElement | null>;
  onLand: () => void;
  reaction: ReactionLook;
}) => {
  const ghostRef = React.useRef<HTMLSpanElement>(null);
  const land = React.useEffectEvent(onLand);

  React.useLayoutEffect(() => {
    const ghost = ghostRef.current;
    if (!ghost) return;
    const { from } = flight;
    const size = ghost.offsetWidth || 16;
    const selector = `[${REACTION_ICON_ATTRIBUTE}="${CSS.escape(flight.code)}"]`;
    const findTarget = () =>
      list.current?.querySelector<HTMLElement>(selector) ?? null;
    const place = (progress: number, to: DOMRect) => {
      const scale = lerp(from.width / size, to.width / size, progress);
      ghost.style.transform = `translate3d(${lerp(from.left, to.left, progress)}px, ${lerp(from.top, to.top, progress)}px, 0) scale(${scale})`;
    };

    place(0, from);
    ghost.style.visibility = "visible";

    let frame = 0;
    let flying: null | ReturnType<typeof animate> = null;
    const startedAt = performance.now();

    const fly = (target: HTMLElement) => {
      flying = animate(0, 1, {
        ...FLIGHT,
        onComplete: land,
        onUpdate: progress => {
          if (!target.isConnected) {
            flying?.stop();
            land();

            return;
          }
          place(progress, target.getBoundingClientRect());
        },
      });
    };

    const waitForTarget = () => {
      const target = findTarget();
      if (target) {
        fly(target);

        return;
      }
      if (performance.now() - startedAt > TARGET_TIMEOUT_MS) {
        land();

        return;
      }
      frame = requestAnimationFrame(waitForTarget);
    };
    waitForTarget();

    return () => {
      cancelAnimationFrame(frame);
      flying?.stop();
    };
  }, [flight, list]);

  return createPortal(
    <span
      aria-hidden="true"
      className="pointer-events-none invisible fixed top-0 left-0 z-60 inline-flex origin-top-left will-change-transform"
      ref={ghostRef}
    >
      <ReactionIcon reaction={reaction} />
    </span>,
    document.body,
  );
};
