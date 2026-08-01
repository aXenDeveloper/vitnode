import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { AdminDashboardWidgetLayoutItem } from "@/database/dashboard";

import { core_admin_dashboard } from "@/database/dashboard";

const widgetIdRegex = /^[@\w][\w./@-]*:[\w.-]+(#\d{1,3})?$/;

export const zodWidgetId = z
  .string()
  .min(3)
  .max(132)
  .regex(widgetIdRegex, { message: "Invalid widget id" })
  .openapi({ example: "@vitnode/core:notes" });

export const zodDashboardWidgetSettings = z
  .record(z.string(), z.unknown())
  .openapi({ example: { content: "Remember to renew the TLS cert." } });

const zodSize = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const zodDashboardWidgetLayoutItem = z.object({
  id: zodWidgetId,
  rows: zodSize.openapi({ example: 1 }),
  span: zodSize.openapi({ example: 2 }),
});

export const zodStoredDashboardWidget = z.object({
  hidden: z.boolean().optional(),
  id: zodWidgetId,
  rows: zodSize.optional(),
  settings: zodDashboardWidgetSettings.optional(),
  span: zodSize.optional(),
});

export const MAX_WIDGETS = 64;
export const MAX_STORED_WIDGETS = MAX_WIDGETS * 2;

export const zodDashboardLayout = z.object({
  managed: z.array(zodWidgetId).max(MAX_STORED_WIDGETS),
  widgets: z.array(zodDashboardWidgetLayoutItem).max(MAX_WIDGETS),
});

const MAX_SETTINGS_BYTES = 64 * 1024;
const encoder = new TextEncoder();

/** Counted in UTF-8 bytes, so the cap means the same thing in every script. */
export const isSettingsTooLarge = (settings: unknown): boolean =>
  encoder.encode(JSON.stringify(settings ?? {})).length > MAX_SETTINGS_BYTES;

export const mergeLayoutForSave = ({
  incoming,
  managed,
  previous,
}: {
  incoming: Pick<
    Required<AdminDashboardWidgetLayoutItem>,
    "id" | "rows" | "span"
  >[];
  managed: string[];
  previous: AdminDashboardWidgetLayoutItem[];
}): AdminDashboardWidgetLayoutItem[] => {
  const previousById = new Map(previous.map(widget => [widget.id, widget]));
  const managedIds = new Set(managed);
  const seen = new Set<string>();
  const next: AdminDashboardWidgetLayoutItem[] = [];

  for (const widget of incoming) {
    if (seen.has(widget.id)) continue;
    seen.add(widget.id);

    const settings = previousById.get(widget.id)?.settings;
    next.push({
      id: widget.id,
      span: widget.span,
      rows: widget.rows,
      ...(settings ? { settings } : {}),
    });
  }

  for (const widget of previous) {
    if (seen.has(widget.id)) continue;

    next.push(managedIds.has(widget.id) ? { ...widget, hidden: true } : widget);
  }

  return next;
};

export const mergeWidgetSettings = ({
  previous,
  settings,
  widgetId,
}: {
  previous: AdminDashboardWidgetLayoutItem[];
  settings: Record<string, unknown>;
  widgetId: string;
}): AdminDashboardWidgetLayoutItem[] => {
  const index = previous.findIndex(widget => widget.id === widgetId);
  if (index === -1) return [...previous, { id: widgetId, settings }];

  return previous.map((widget, at) =>
    at === index
      ? { ...widget, settings: { ...widget.settings, ...settings } }
      : widget,
  );
};

export const getDashboardWidgets = async (
  c: Context<EnvVitNode>,
  userId: number,
): Promise<AdminDashboardWidgetLayoutItem[]> => {
  const [row] = await c
    .get("db")
    .select({ widgets: core_admin_dashboard.widgets })
    .from(core_admin_dashboard)
    .where(eq(core_admin_dashboard.userId, userId))
    .limit(1);

  return row?.widgets ?? [];
};

export const mutateDashboardWidgets = async (
  c: Context<EnvVitNode>,
  userId: number,
  mutate: (
    widgets: AdminDashboardWidgetLayoutItem[],
  ) => AdminDashboardWidgetLayoutItem[],
): Promise<void> => {
  await c.get("db").transaction(async tx => {
    await tx
      .insert(core_admin_dashboard)
      .values({ userId })
      .onConflictDoNothing({ target: core_admin_dashboard.userId });

    const [row] = await tx
      .select({ widgets: core_admin_dashboard.widgets })
      .from(core_admin_dashboard)
      .where(eq(core_admin_dashboard.userId, userId))
      .limit(1)
      .for("update");

    await tx
      .update(core_admin_dashboard)
      .set({ widgets: mutate(row?.widgets ?? []), updatedAt: new Date() })
      .where(eq(core_admin_dashboard.userId, userId));
  });
};
