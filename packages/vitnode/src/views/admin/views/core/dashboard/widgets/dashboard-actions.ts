import type { DashboardLayoutItem } from "./types";

/**
 * Everything the dashboard board can *do*, as one object both frameworks
 * satisfy.
 *
 * Four callbacks, and they are grouped rather than passed as four props because
 * every one of them has to reach the same place - the settings dialog, three
 * components below the provider - and threading four values through
 * `DashboardGrid` and `WidgetCard` would be four chances to forget one.
 *
 *     Next.js         server actions; the two saves end in `revalidatePath`,
 *                     and the two loads return a *rendered* widget from the
 *                     server, because a widget's `component` may be a Server
 *                     Component
 *     TanStack Start  browser calls to the same Hono routes; the two saves end
 *                     in a query invalidation, and the two loads render the
 *                     widget from a browser registry
 *
 * ## Why the loads return a node rather than settings
 *
 * In Next.js a widget's `component` runs on the server and only its *output* can
 * cross the boundary - a component function is not serialisable. So "refresh
 * this widget" is necessarily "ask the server to render it again", and the board
 * stores the promise of a node. A browser can do better, but it cannot do
 * *differently* without the board growing two code paths, so it satisfies the
 * same shape and resolves immediately.
 */
export interface DashboardActions {
  /** One widget, re-rendered against whatever settings are stored now. */
  loadWidgetContent: (widgetId: string) => Promise<React.ReactNode>;
  /** One widget's settings form, or `null` when it has none. */
  loadWidgetSettings: (widgetId: string) => Promise<React.ReactNode>;
  /**
   * Persist the board, and refresh it on success.
   *
   * `managed` is every stored id this board spoke for, so the API can tell a
   * widget the admin removed from a widget this board never knew about - see
   * `zodDashboardLayout`.
   */
  saveLayout: (args: {
    managed: string[];
    widgets: DashboardLayoutItem[];
  }) => Promise<DashboardMutationResult>;
  /** Persist one widget's settings. The dialog refreshes the widget after. */
  saveWidgetSettings: (args: {
    settings: Record<string, unknown>;
    widgetId: string;
  }) => Promise<DashboardMutationResult>;
}

/**
 * What a dashboard mutation reports back.
 *
 * `undefined` for success, because that is what the Next.js server actions
 * already return and every caller already writes `if (res?.error)`.
 */
export type DashboardMutationResult = undefined | { error?: string };
