import { camelCase, index } from "drizzle-orm/pg-core";

import type {
  AdminDashboardWidgetRows,
  AdminDashboardWidgetSettings,
  AdminDashboardWidgetSpan,
} from "@/lib/plugin";

import { core_users } from "./users";

export interface AdminDashboardWidgetLayoutItem {
  hidden?: boolean;
  id: string;
  rows?: AdminDashboardWidgetRows;
  settings?: AdminDashboardWidgetSettings;
  span?: AdminDashboardWidgetSpan;
}

export const core_admin_dashboard = camelCase.table.withRLS(
  "core_admin_dashboard",
  t => ({
    id: t.serial().primaryKey(),
    userId: t
      .integer()
      .references(() => core_users.id, {
        onDelete: "cascade",
      })
      .notNull()
      .unique(),
    widgets: t
      .jsonb()
      .$type<AdminDashboardWidgetLayoutItem[]>()
      .notNull()
      .default([]),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [index("core_admin_dashboard_user_id_idx").on(t.userId)],
);
