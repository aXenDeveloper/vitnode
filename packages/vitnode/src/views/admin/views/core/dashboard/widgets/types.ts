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

export interface DashboardWidgetCatalogEntry extends DashboardWidgetOption {
  content: React.ReactNode;

  hasSettings?: boolean;
}

/** One card on the board: a catalog entry sized by the admin's layout. */
export interface DashboardWidgetView extends DashboardWidgetCatalogEntry {
  contentKey: string;

  instanceId: string;
  rows: AdminDashboardWidgetRows;
  span: AdminDashboardWidgetSpan;
}
