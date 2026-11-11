import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { inArray, sql } from "drizzle-orm";

import { findReportTarget } from "@/api/lib/moderation/registry";
import {
  core_moderation_sanctions,
  core_moderation_warnings,
} from "@/database/warnings";
import { containsLikePattern } from "@/lib/api/like-pattern";
import {
  isSanctionActiveAt,
  WARNING_STATUSES,
  warningStatusAt,
} from "@/lib/moderation/warnings";

import type { SanctionRow, WarningRow } from "./warnings-view";

import { warningMessageSchema } from "../moderation.schema";

const textSchema = z.array(
  z.object({ languageCode: z.string(), value: z.string() }),
);

/**
 * What a member may read about their own warnings. Built field by field so
 * staff notes, override explanations, revocation reasons and the issuing
 * moderator never leave the server.
 */
export const ownWarningSchema = z.object({
  id: z.number(),
  status: z.enum(WARNING_STATUSES),
  points: z.number(),
  reason: textSchema.nullable(),
  message: warningMessageSchema,
  issuedAt: z.date(),
  expiresAt: z.date().nullable(),
  content: z
    .object({ title: z.string().nullable(), url: z.string().nullable() })
    .nullable(),
});

export const ownSanctionSchema = z.object({
  id: z.number(),
  active: z.boolean(),
  startsAt: z.date(),
  endsAt: z.date().nullable(),
  revoked: z.boolean(),
  liftedAt: z.date().nullable(),
  warningId: z.number().nullable(),
});

export const OWN_HISTORY_KINDS = ["warning", "suspension"] as const;

export const OWN_HISTORY_STATUSES = [
  "active",
  "expired",
  "revoked",
  "lifted",
  "ended",
] as const;

export const OWN_HISTORY_PAGE_SIZE = 10;

export const ownHistoryItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("warning"), warning: ownWarningSchema }),
  z.object({ kind: z.literal("suspension"), suspension: ownSanctionSchema }),
]);

export const serializeOwnWarnings = async (
  c: Context,
  rows: WarningRow[],
  now: Date,
): Promise<z.infer<typeof ownWarningSchema>[]> => {
  const registry = c.get("core").moderation;

  const contentOf = async (row: WarningRow) => {
    if (!row.pluginId || !row.targetType || !row.targetId) return null;
    const target = findReportTarget(registry, {
      pluginId: row.pluginId,
      type: row.targetType,
    });
    const current = target
      ? await target.definition
          .current(c, { locale: null, targetId: row.targetId })
          .catch(() => null)
      : null;

    return {
      title: row.contentSnapshot?.title ?? null,
      url: current && !current.hidden ? current.url : null,
    };
  };

  return await Promise.all(
    rows.map(async row => ({
      id: row.id,
      status: warningStatusAt(row, now),
      points: row.points,
      reason: row.reasonSnapshot?.title ?? null,
      message: row.message,
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
      content: await contentOf(row),
    })),
  );
};

export const serializeOwnSanction = (
  row: SanctionRow,
  now: Date,
): z.infer<typeof ownSanctionSchema> => ({
  id: row.id,
  active: isSanctionActiveAt(row, now),
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  revoked: row.revokedAt !== null,
  liftedAt: row.revokedAt,
  warningId: row.warningId,
});

interface OwnHistoryQuery {
  kinds: (typeof OWN_HISTORY_KINDS)[number][];
  order: "asc" | "desc";
  orderBy: "issuedAt" | "points";
  page: number;
  pageSize: number;
  search?: string;
  statuses: (typeof OWN_HISTORY_STATUSES)[number][];
}

export const loadOwnHistoryPage = async (
  c: Context,
  userId: number,
  query: OwnHistoryQuery,
  now: Date,
) => {
  const w = core_moderation_warnings;
  const s = core_moderation_sanctions;
  const search = query.search?.trim();
  const pattern = search ? containsLikePattern(search) : null;
  const at = sql.param(now, w.issuedAt);

  const history = sql`(
    select 'warning' as kind, ${w.id} as id, ${w.issuedAt} as at, ${w.points} as points,
      case
        when ${w.revokedAt} is not null then 'revoked'
        when ${w.expiresAt} is not null and ${w.expiresAt} <= ${at} then 'expired'
        else 'active'
      end as status
    from ${w}
    where ${w.userId} = ${userId}
    ${
      pattern
        ? sql`and (
            jsonb_path_query_array(${w.message}, 'strict $.**.text')::text ilike ${pattern}
            or coalesce(jsonb_path_query_array(${w.reasonSnapshot}, '$.title[*].value')::text, '') ilike ${pattern}
          )`
        : sql``
    }
    union all
    select 'suspension' as kind, ${s.id} as id, ${s.startsAt} as at, 0 as points,
      case
        when ${s.revokedAt} is not null then 'lifted'
        when ${s.startsAt} <= ${at} and (${s.endsAt} is null or ${s.endsAt} > ${at}) then 'active'
        else 'ended'
      end as status
    from ${s}
    where ${s.userId} = ${userId} ${pattern ? sql`and false` : sql``}
  ) as history`;

  const conditions = [
    query.kinds.length > 0
      ? sql`(${sql.join(
          query.kinds.map(kind => sql`kind = ${kind}`),
          sql` or `,
        )})`
      : null,
    query.statuses.length > 0
      ? sql`(${sql.join(
          query.statuses.map(status => sql`status = ${status}`),
          sql` or `,
        )})`
      : null,
  ].filter(condition => condition !== null);
  const where =
    conditions.length > 0
      ? sql`where ${sql.join(conditions, sql` and `)}`
      : sql``;
  const direction = query.order === "asc" ? sql`asc` : sql`desc`;
  const orderBy =
    query.orderBy === "points"
      ? sql`points ${direction}, at desc, id desc`
      : sql`at ${direction}, id ${direction}`;

  const db = c.get("db");
  const pageAt = async (page: number) =>
    await db.execute<{ id: number; kind: (typeof OWN_HISTORY_KINDS)[number] }>(
      sql`select kind, id from ${history} ${where} order by ${orderBy} limit ${query.pageSize} offset ${(page - 1) * query.pageSize}`,
    );
  const [totalResult, speculativePage] = await Promise.all([
    db.execute<{ total: number | string }>(
      sql`select count(*) as total from ${history} ${where}`,
    ),
    pageAt(query.page),
  ]);
  const total = Number([...totalResult][0]?.total ?? 0);
  const page = Math.max(
    1,
    Math.min(query.page, Math.ceil(total / query.pageSize) || 1),
  );
  const pageResult = page === query.page ? speculativePage : await pageAt(page);
  const refs = [...pageResult].map(row => ({ id: row.id, kind: row.kind }));
  const warningIds = refs.filter(r => r.kind === "warning").map(r => r.id);
  const sanctionIds = refs.filter(r => r.kind === "suspension").map(r => r.id);

  const [warningRows, sanctionRows]: [WarningRow[], SanctionRow[]] =
    await Promise.all([
      warningIds.length > 0
        ? db.select().from(w).where(inArray(w.id, warningIds))
        : Promise.resolve([]),
      sanctionIds.length > 0
        ? db.select().from(s).where(inArray(s.id, sanctionIds))
        : Promise.resolve([]),
    ]);
  const warnings = new Map(
    (await serializeOwnWarnings(c, warningRows, now)).map(item => [
      item.id,
      item,
    ]),
  );
  const sanctions = new Map(
    sanctionRows.map(row => [row.id, serializeOwnSanction(row, now)]),
  );

  const items = refs.flatMap((ref): z.infer<typeof ownHistoryItemSchema>[] => {
    if (ref.kind === "warning") {
      const warning = warnings.get(ref.id);

      return warning ? [{ kind: "warning", warning }] : [];
    }
    const suspension = sanctions.get(ref.id);

    return suspension ? [{ kind: "suspension", suspension }] : [];
  });

  return { items, page, total };
};
