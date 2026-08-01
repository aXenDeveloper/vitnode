import type { AdminDashboardWidgetLayoutItem } from "@/database/dashboard";
import type {
  AdminDashboardWidget,
  AdminDashboardWidgetRows,
  AdminDashboardWidgetSpan,
} from "@/lib/plugin";

export type {
  AdminDashboardWidgetLayoutItem,
  AdminDashboardWidgetRows,
  AdminDashboardWidgetSpan,
};

/**
 * A stored layout item the normalizer has vouched for: its widget is installed
 * and this admin may see it, and it carries a size even if the column did not.
 */
export interface DashboardLayoutItem extends AdminDashboardWidgetLayoutItem {
  rows: AdminDashboardWidgetRows;
  span: AdminDashboardWidgetSpan;
}

/**
 * The heading a widget sits under in the panel: either a category its own
 * plugin defined, or - by default - the plugin itself.
 */
export interface DashboardWidgetCategory {
  /** `${pluginId}:${category}`, or just `${pluginId}` for the fallback. */
  id: string;
  title: string;
}

/** A widget after the resolver has merged in its plugin id and translations. */
export interface ResolvedDashboardWidget extends Omit<
  AdminDashboardWidget,
  "category" | "id" | "permission"
> {
  category: DashboardWidgetCategory;
  defaultRows: AdminDashboardWidgetRows;
  defaultSpan: AdminDashboardWidgetSpan;
  desc?: string;
  /** Full id, e.g. `@vitnode/core:notes`. */
  id: string;
  minSpan: AdminDashboardWidgetSpan;
  title: string;
}

/** A widget the admin has not placed yet - offered in the side panel. */
export interface DashboardWidgetOption {
  /** Stays in the panel even once placed, so more copies can be dragged in. */
  allowMultiple?: boolean;
  category: DashboardWidgetCategory;
  defaultRows: AdminDashboardWidgetRows;
  defaultSpan: AdminDashboardWidgetSpan;
  desc?: string;
  icon?: React.ReactNode;
  id: string;
  minSpan: AdminDashboardWidgetSpan;
  title: string;
}

/**
 * What the client grid receives. The widget's `component` runs on the server
 * and only its output (`content`) crosses the boundary - a component function
 * could never be serialized.
 */
export interface DashboardWidgetCatalogEntry extends DashboardWidgetOption {
  content: React.ReactNode;
  /**
   * The widget's settings form, rendered on the server the same way. Absent
   * when the widget registered no `settingsComponent` - which is also what the
   * card keys "does this widget have a gear?" on.
   */
  settingsContent?: React.ReactNode;
}

/** One card on the board: a catalog entry sized by the admin's layout. */
export interface DashboardWidgetView extends DashboardWidgetCatalogEntry {
  /**
   * Changes whenever the server hands down different settings for this copy.
   * The card is keyed on it, so its own client state starts again from what was
   * actually saved instead of holding on to what it first rendered with.
   */
  contentKey: string;
  /**
   * Identifies this *copy*. Equal to `id` for the first copy of a widget, and
   * what the board keys drag, resize and remove on - `id` alone would collide
   * once a widget is placed twice.
   */
  instanceId: string;
  rows: AdminDashboardWidgetRows;
  span: AdminDashboardWidgetSpan;
}
