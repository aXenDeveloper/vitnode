export const LOGO_VIEW_TRANSITION_NAME = "vitnode-logo";

export const PAGE_VIEW_TRANSITION_TYPE = "vitnode-page";

interface LocationChange {
  pathChanged: boolean;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const pageViewTransitionTypes = ({
  pathChanged,
}: LocationChange): false | string[] => {
  if (!pathChanged || prefersReducedMotion()) return false;

  return [PAGE_VIEW_TRANSITION_TYPE];
};

export const navigationViewTransition = (enabled = true) =>
  enabled ? { types: pageViewTransitionTypes } : false;
