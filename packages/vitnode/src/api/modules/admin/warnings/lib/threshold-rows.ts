import { and, eq, ne, sql } from "drizzle-orm";

import type { ContentDatabase } from "@/content/server/service";

import { core_moderation_warning_thresholds } from "@/database/warnings";

export const LOCK_THRESHOLDS = sql`lock table ${core_moderation_warning_thresholds} in share row exclusive mode`;

export const pointsTaken = async (
  tx: ContentDatabase,
  points: number,
  exceptId?: number,
): Promise<boolean> => {
  const table = core_moderation_warning_thresholds;
  const [row] = await tx
    .select({ id: table.id })
    .from(table)
    .where(
      and(
        eq(table.points, points),
        eq(table.enabled, true),
        exceptId === undefined ? undefined : ne(table.id, exceptId),
      ),
    )
    .limit(1);

  return row !== undefined;
};

export const TARGET = "warning_threshold";
