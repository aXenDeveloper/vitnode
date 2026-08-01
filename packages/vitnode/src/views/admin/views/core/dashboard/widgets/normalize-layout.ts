import type {
  AdminDashboardWidgetLayoutItem,
  AdminDashboardWidgetRows,
  AdminDashboardWidgetSpan,
  DashboardLayoutItem,
  ResolvedDashboardWidget,
} from "./types";

import { widgetIdOf } from "./instance-id";

const clamp = (value: unknown, min: number, fallback: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;

  return Math.min(3, Math.max(min, Math.round(value)));
};

/**
 * Reconciles what an admin saved with what is actually installed right now.
 *
 * Widgets disappear when a plugin is uninstalled or a permission is revoked,
 * and new ones show up when a plugin is added - so the stored layout is treated
 * as a preference, never as the source of truth.
 *
 * An entry may also arrive unsized, when a widget's own settings write had to
 * create it before the admin ever arranged the board. Sizing falls back to the
 * widget's defaults, the same way an out-of-range value does.
 */
export const normalizeLayout = ({
  saved,
  widgets,
}: {
  saved: AdminDashboardWidgetLayoutItem[];
  widgets: ResolvedDashboardWidget[];
}): DashboardLayoutItem[] => {
  const byId = new Map(widgets.map(widget => [widget.id, widget]));
  const placedInstances = new Set<string>();
  const placedWidgets = new Set<string>();
  const result: DashboardLayoutItem[] = [];

  for (const item of saved) {
    const widgetId = widgetIdOf(item.id);
    const widget = byId.get(widgetId);
    // Unknown id: the plugin is gone, or this admin may no longer see it.
    if (!widget || placedInstances.has(item.id)) continue;

    // A second copy of a widget that no longer allows them: keep the first,
    // drop the rest, so turning `allowMultiple` off tidies itself up.
    if (!widget.allowMultiple && placedWidgets.has(widgetId)) continue;

    placedInstances.add(item.id);
    placedWidgets.add(widgetId);

    // Deliberately removed. Marking it placed above is the point: it stops the
    // `defaultEnabled` pass below from putting it straight back.
    if (item.hidden) continue;

    result.push({
      id: item.id,
      span: clamp(
        item.span,
        widget.minSpan,
        Math.max(widget.defaultSpan, widget.minSpan),
      ) as AdminDashboardWidgetSpan,
      rows: clamp(item.rows, 1, widget.defaultRows) as AdminDashboardWidgetRows,
      ...(item.settings ? { settings: item.settings } : {}),
    });
  }

  // Anything the admin has never seen and that ships enabled goes to the end,
  // so a freshly installed plugin shows up without wiping their arrangement.
  for (const widget of widgets) {
    if (placedWidgets.has(widget.id) || !widget.defaultEnabled) continue;

    result.push({
      id: widget.id,
      span: Math.max(
        widget.defaultSpan,
        widget.minSpan,
      ) as AdminDashboardWidgetSpan,
      rows: widget.defaultRows,
    });
  }

  return result;
};
