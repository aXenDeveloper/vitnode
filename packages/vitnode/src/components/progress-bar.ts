/**
 * BProgress' own options, minus the ones a config file cannot carry.
 *
 * Left out on purpose: `parent` (an `HTMLElement`), `barSelector`,
 * `indeterminateSelector`, `spinnerSelector` and `positionUsing`. The first is
 * a DOM node, which never survives the server-to-client hop a Next.js layout
 * hands this config over; the rest name internals of one implementation, which
 * is the opposite of what belongs in an app's configuration.
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
 *
 * These are the fields an install actually sets, so the config now describes
 * the progress bar instead of naming somebody's implementation of it. The
 * Next.js implementation still receives it whole: `progress-bar.test-d.ts`
 * holds this type to being assignable to `ProgressProvider`'s props, so a field
 * that drifts out of shape fails `pnpm test:types` rather than a build.
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
