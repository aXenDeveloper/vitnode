import { relations } from "drizzle-orm";
import { index, pgTable } from "drizzle-orm/pg-core";

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

export const core_admin_dashboard = pgTable(
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
).enableRLS();

export const core_admin_dashboard_relations = relations(
  core_admin_dashboard,
  ({ one }) => ({
    user: one(core_users, {
      fields: [core_admin_dashboard.userId],
      references: [core_users.id],
    }),
  }),
);
