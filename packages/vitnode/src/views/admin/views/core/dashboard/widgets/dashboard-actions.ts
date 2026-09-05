import type { DashboardLayoutItem } from "./types";

export interface DashboardActions {
  /** One widget, re-rendered against whatever settings are stored now. */
  loadWidgetContent: (widgetId: string) => Promise<React.ReactNode>;
  /** One widget's settings form, or `null` when it has none. */
  loadWidgetSettings: (widgetId: string) => Promise<React.ReactNode>;

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

export type DashboardMutationResult = undefined | { error?: string };
