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
 * The dashboard's own heading, resolved above the board's `<Suspense>`
 * boundary so the fallback and the board render the same one. The board cannot
 * own it: `DashboardEditActions` sits in its action slot and reads the board's
 * context, so a fallback rendering the header alone would throw.
 */
export interface DashboardHeaderContent {
  desc: React.ReactNode;
  h1: React.ReactNode;
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
   * Whether the widget registered a `settingsComponent` - what the card keys
   * "does this widget have a gear?" on. The form itself does not ride along:
   * it is rendered on the server only once a dialog asks for it, so an ordinary
   * dashboard load pays for no settings form at all.
   */
  hasSettings?: boolean;
}

/** One card on the board: a catalog entry sized by the admin's layout. */
export interface DashboardWidgetView extends DashboardWidgetCatalogEntry {
  /**
   * Changes whenever this copy is rendered against different settings - by the
   * server on load, or by the board after its settings dialog saved. The card's
   * body is keyed on it, so the widget's own client state starts again from
   * what was actually saved instead of holding on to what it first rendered
   * with.
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
