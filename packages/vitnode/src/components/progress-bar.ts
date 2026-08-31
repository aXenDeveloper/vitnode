/**
 * BProgress' own options, minus the ones a config file cannot carry.
 *
 * Left out on purpose: `parent` (an `HTMLElement`), `barSelector`,
 * `indeterminateSelector`, `spinnerSelector` and `positionUsing`. The first is
 * a DOM node, which never survives the server-to-client hop this config is
 * handed across; the rest name internals of one implementation, which is the
 * opposite of what belongs in an app's configuration.
 */
export interface ProgressBarOptions {
  direction?: "ltr" | "rtl";
  easing?: string;
  indeterminate?: boolean;
  maximum?: number;
  minimum?: number;
  showSpinner?: boolean;
  speed?: number;
  template?: null | string;
  trickle?: boolean;
  trickleSpeed?: number;
}

/**
 * How the navigation progress bar looks and behaves.
 *
 * This used to be typed as `React.ComponentProps<typeof ProgressProvider>` from
 * `@bprogress/next`, which made the whole of `VitNodeConfig` unreadable outside
 * a Next.js app: every consumer of the config type - including one that never
 * renders a progress bar - had to resolve a package that only exists there.
 * These are the fields an install actually sets, so the config describes the
 * progress bar instead of naming somebody's implementation of it.
 *
 * NOTHING CURRENTLY READS THIS. Its only consumer was the Next.js provider tree
 * deleted in Stage 17, which spread it into `@bprogress/next`; that dependency
 * is gone, and so is the `progress-bar.test-d.ts` that used to pin this type to
 * `ProgressProvider`'s props. The shape is kept because it is framework-neutral
 * and describes a real feature a TanStack Router implementation could pick up -
 * `useRouterState({ select: (s) => s.status })` is the hook it would need - but
 * setting `progressBar` in a config today has no effect. Either wire it up or
 * remove the field; leaving it as decoration is the one option that misleads.
 */
export interface ProgressBarConfig {
  /** CSS colour of the bar. Defaults to `var(--primary)`. */
  color?: string;
  /** Wait this many ms before showing the bar, so fast navigations show none. */
  delay?: number;
  /** Skip the bar when the target URL is the current one. Defaults to `true`. */
  disableSameURL?: boolean;
  /** Ship no CSS for the bar, to style it entirely from the app's own sheet. */
  disableStyle?: boolean;
  /** Height of the bar, e.g. `"4px"`. */
  height?: string;
  /** `nonce` for the injected `<style>`, for a strict Content-Security-Policy. */
  nonce?: string;
  options?: ProgressBarOptions;
  /** Leave the bar out of shallow (search-param only) navigations. */
  shallowRouting?: boolean;
  spinnerPosition?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  /** Where the bar starts, 0-1, so a navigation never looks stalled at zero. */
  startPosition?: number;
  /** Wait this many ms before hiding a finished bar. */
  stopDelay?: number;
  /** Extra CSS appended to the bar's own stylesheet. */
  style?: string;
}
