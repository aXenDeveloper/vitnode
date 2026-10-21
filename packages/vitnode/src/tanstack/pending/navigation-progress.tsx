import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { useIsRouteNavigating } from "./navigation-pending";

const START_SCALE = 0.08;
const CEILING_SCALE = 0.94;
const TRICKLE_MS = 20_000;
const TRICKLE_TIME_CONSTANT_MS = 2_500;
const APPEAR_MS = 160;
const FINISH_MS = 260;
const FADE_MS = 300;
const FADE_DELAY_MS = 140;
const EASE_FLUID = "cubic-bezier(0.22, 1, 0.36, 1)";
const TRICKLE_FALLBACK_EASING = "cubic-bezier(0.08, 0.75, 0.2, 1)";

// An exponential approach - fast at first, then ever slower, never stopping -
// so a slow navigation keeps visibly moving without ever reaching the end.
const TRICKLE_EASING = (() => {
  const reach = 1 - Math.exp(-TRICKLE_MS / TRICKLE_TIME_CONSTANT_MS);
  const samples = 32;
  const points = Array.from({ length: samples + 1 }, (_, index) => {
    const time = (index / samples) ** 2;
    const progress =
      (1 - Math.exp((-time * TRICKLE_MS) / TRICKLE_TIME_CONSTANT_MS)) / reach;

    return `${progress.toFixed(4)} ${(time * 100).toFixed(2)}%`;
  });

  return `linear(${points.join(", ")})`;
})();

const trickleEasing = (): string =>
  typeof CSS !== "undefined" &&
  CSS.supports("transition-timing-function", "linear(0, 1)")
    ? TRICKLE_EASING
    : TRICKLE_FALLBACK_EASING;

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const scaleOf = (bar: HTMLElement): number => {
  const matrix = /^matrix\(([^,]+)/.exec(getComputedStyle(bar).transform);

  return matrix ? Number.parseFloat(matrix[1] ?? "0") : 0;
};

const opacityOf = (bar: HTMLElement): number =>
  Number.parseFloat(getComputedStyle(bar).opacity) || 0;

interface ProgressController {
  done: () => void;
  reset: () => void;
  start: (delay: number) => void;
}

const createProgressController = (
  bar: HTMLElement,
  onVisibleChange: (visible: boolean) => void,
): ProgressController => {
  let phase: "finishing" | "idle" | "running" = "idle";
  let revealAt = 0;
  let animations: Animation[] = [];

  const cancel = () => {
    for (const animation of animations) animation.cancel();
    animations = [];
  };

  const reset = () => {
    cancel();
    phase = "idle";
    onVisibleChange(false);
  };

  const start = (delay: number) => {
    if (phase === "running") return;

    const resuming = phase === "finishing";
    const scale = resuming ? scaleOf(bar) : 0;
    const from = scale > 0 && scale < CEILING_SCALE ? scale : START_SCALE;
    const opacity = resuming ? opacityOf(bar) : 0;
    const wait = resuming ? 0 : Math.max(delay, 0);
    const reduced = prefersReducedMotion();

    cancel();
    phase = "running";
    revealAt = performance.now() + wait;

    const appear = bar.animate([{ opacity }, { opacity: 1 }], {
      delay: wait,
      duration: APPEAR_MS,
      easing: "ease-out",
      fill: "both",
    });
    const trickle = reduced
      ? bar.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(1)" }], {
          duration: 1,
          fill: "both",
        })
      : bar.animate(
          [
            { transform: `scaleX(${from})` },
            { transform: `scaleX(${CEILING_SCALE})` },
          ],
          {
            delay: wait,
            duration: TRICKLE_MS,
            easing: trickleEasing(),
            fill: "both",
          },
        );

    appear.addEventListener("finish", () => {
      if (phase === "running" && animations.includes(appear)) {
        onVisibleChange(true);
      }
    });
    animations = [appear, trickle];
  };

  const done = () => {
    if (phase !== "running") return;

    // Finished before the bar ever appeared - leave nothing behind.
    if (performance.now() < revealAt) {
      reset();

      return;
    }

    const reduced = prefersReducedMotion();
    const scale = scaleOf(bar);
    const opacity = opacityOf(bar);

    cancel();
    phase = "finishing";
    onVisibleChange(false);

    const finish = bar.animate(
      [{ transform: `scaleX(${scale})` }, { transform: "scaleX(1)" }],
      { duration: reduced ? 1 : FINISH_MS, easing: EASE_FLUID, fill: "both" },
    );
    const fade = bar.animate([{ opacity }, { opacity: 0 }], {
      delay: reduced ? 0 : FADE_DELAY_MS,
      duration: FADE_MS,
      easing: "ease-in",
      fill: "both",
    });

    fade.addEventListener("finish", () => {
      if (phase === "finishing" && animations.includes(fade)) reset();
    });
    animations = [finish, fade];
  };

  return { done, reset, start };
};

/**
 * A slim bar at the top of the viewport for client-side route navigations.
 * Starts on the router's pending navigation, finishes when the router commits
 * the destination - or its error, not-found or redirect target - and appears
 * only once a navigation outlasts `delay`. Same-URL reloads, preloads and
 * TanStack Query refetches never start it. The current page stays on screen
 * and usable meanwhile. Under `prefers-reduced-motion` it fades in and out at
 * full width instead of moving.
 *
 * Mounted once by `VitNodeRootProviders`; render it yourself only in an app
 * that does not use them.
 */
export const NavigationProgress = ({
  delay = 150,
}: {
  /** How long a navigation must last before the bar appears, in ms. Defaults to `150`. */
  delay?: number;
}) => {
  const t = useTranslations("core.global");
  const isNavigating = useIsRouteNavigating();
  const barRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<null | ProgressController>(null);
  const [isAnnounced, setIsAnnounced] = useState(false);

  useEffect(() => {
    const bar = barRef.current;

    if (!bar || typeof bar.animate !== "function") return;

    controllerRef.current ??= createProgressController(bar, setIsAnnounced);

    if (isNavigating) controllerRef.current.start(delay);
    else controllerRef.current.done();
  }, [delay, isNavigating]);

  useEffect(
    () => () => {
      controllerRef.current?.reset();
      controllerRef.current = null;
    },
    [],
  );

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-100 h-0.5"
        data-slot="navigation-progress"
      >
        <div
          className="bg-primary shadow-primary/60 h-full w-full origin-left opacity-0 shadow-sm will-change-transform rtl:origin-right"
          ref={barRef}
          style={{ transform: "scaleX(0)" }}
        />
      </div>

      <span className="sr-only" role="status">
        {isAnnounced ? t("navigation_progress") : null}
      </span>
    </>
  );
};
