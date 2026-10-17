export const LOGO_VIEW_TRANSITION_NAME = "vitnode-logo";

export const HEADER_VIEW_TRANSITION_NAMES = {
  actions: "vitnode-header-actions",
  bar: "vitnode-header",
  navigation: "vitnode-header-navigation",
} as const;

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

/**
 * The router's `defaultViewTransition`: a page transition (type
 * `vitnode-page`) when the path changes, nothing for search or hash changes or
 * when the visitor prefers reduced motion. Pass `false` to turn transitions off,
 * e.g. from `vitNodeConfig.viewTransitions`.
 */
export const navigationViewTransition = (enabled = true) =>
  enabled ? { types: pageViewTransitionTypes } : false;
