import type { SQL } from "drizzle-orm";
import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { and, desc, eq, gte, ilike, lt, ne, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type {
  AuditActorType,
  AuditArea,
  AuditChanges,
} from "@/lib/audit/const";

import { core_audit_logs } from "@/database/audit";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import { containsLikePattern } from "@/lib/api/like-pattern";
import {
  AUDIT_ACTION_MAX_LENGTH,
  AUDIT_ACTOR_TYPES,
  AUDIT_AREAS,
  AUDIT_PLUGIN_ID_MAX_LENGTH,
  AUDIT_STAFF_LOGS,
  AUDIT_TARGET_ID_MAX_LENGTH,
  AUDIT_TARGET_TYPE_MAX_LENGTH,
} from "@/lib/audit/const";

export const AUDIT_DEFAULT_PAGE_SIZE = 25;
export const AUDIT_MAX_PAGE_SIZE = 100;
const AUDIT_SEARCH_MAX_LENGTH = 100;

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "A date as YYYY-MM-DD.")
  .openapi({ example: "2026-10-24" });

/** The filters every audit list understands, as query parameters. */
export const zodAuditFilters = z.object({
  action: z.string().max(AUDIT_ACTION_MAX_LENGTH).optional(),
  actorId: z.coerce.number().int().positive().optional(),
  area: z.enum(AUDIT_AREAS).optional(),
  /** First day included, in UTC. */
  from: day.optional(),
  pluginId: z.string().max(AUDIT_PLUGIN_ID_MAX_LENGTH).optional(),
  /** Matches the target's label, the action and the actor's name. */
  search: z.string().trim().max(AUDIT_SEARCH_MAX_LENGTH).optional(),
  targetId: z.string().max(AUDIT_TARGET_ID_MAX_LENGTH).optional(),
  targetType: z.string().max(AUDIT_TARGET_TYPE_MAX_LENGTH).optional(),
  /** Last day included, in UTC. */
  to: day.optional(),
  /**
   * Which staff log: `moderator` keeps the moderator area, `admin` everything
   * else - AdminCP, member and system activity.
   */
  staff: z.enum(AUDIT_STAFF_LOGS).optional(),
});

export type AuditFilters = z.infer<typeof zodAuditFilters>;

export const zodAuditPageQuery = zodAuditFilters.extend({
  cursor: z.string().max(200).optional(),
  first: z.coerce.number().int().min(1).max(AUDIT_MAX_PAGE_SIZE).optional(),
});

const zodAuditActor = z
  .object({
    id: z.number(),
    name: z.string(),
    nameCode: z.string(),
    roleColor: z.string().nullable(),
    rolePrefix: z.string().nullable(),
  })
  .nullable();

const zodAuditChanges = z
  .record(
    z.string(),
    z.object({
      from: z.unknown().optional(),
      redacted: z.literal(true).optional(),
      to: z.unknown().optional(),
    }),
  )
  .nullable();

const zodAuditPageInfo = z.object({
  endCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
});

/** One entry as a list shows it - no changes, no metadata. */
export const zodAuditListEntry = z.object({
  action: z.string(),
  /** The account as it is now, or `null` for the system or a deleted account. */
  actor: zodAuditActor,
  /** The name the entry was written under, kept after the account is gone. */
  actorName: z.string().nullable(),
  actorType: z.enum(AUDIT_ACTOR_TYPES),
  area: z.enum(AUDIT_AREAS),
  contentTypeId: z.string().nullable(),
  createdAt: z.date(),
  id: z.number(),
  pluginId: z.string(),
  revisionId: z.number().nullable(),
  scope: z.object({ family: z.string(), id: z.string() }).nullable(),
  target: z.object({
    id: z.string().nullable(),
    label: z.string().nullable(),
    type: z.string(),
  }),
});

export type AuditListEntry = z.infer<typeof zodAuditListEntry>;

export const zodAuditPage = z.object({
  edges: z.array(zodAuditListEntry),
  pageInfo: zodAuditPageInfo,
});

/** One resource's history: list entries plus their recorded changes and metadata. */
export const zodAuditEntityPage = z.object({
  edges: z.array(
    zodAuditListEntry.extend({
      changes: zodAuditChanges,
      metadata: z.record(z.string(), z.unknown()),
    }),
  ),
  pageInfo: zodAuditPageInfo,
});

/** One entry in full, as the detail sheet shows it. */
export const zodAuditDetail = zodAuditListEntry.extend({
  changes: zodAuditChanges,
  /** Needs `can_view_sensitive`; `null` otherwise. */
  correlationId: z.string().nullable(),
  /** Needs `can_view_sensitive`; `null` otherwise. */
  ipAddress: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  /** The content revision the entry points at, when it still exists and the viewer may read it. */
  revision: z
    .object({
      available: z.boolean(),
      fields: z.array(
        z.object({
          after: z.unknown(),
          before: z.unknown(),
          name: z.string(),
        }),
      ),
      operation: z.string().nullable(),
      version: z.number().nullable(),
    })
    .nullable(),
  /** An AdminCP path to the target, only when the viewer may open it. */
  targetHref: z.string().nullable(),
});

export type AuditDetail = z.infer<typeof zodAuditDetail>;

const startOfDay = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

/** The SQL of the filters, ANDed. */
export const auditFilterConditions = (filters: AuditFilters): SQL[] => {
  const conditions: (SQL | undefined)[] = [
    filters.action ? eq(core_audit_logs.action, filters.action) : undefined,
    filters.actorId ? eq(core_audit_logs.actorId, filters.actorId) : undefined,
    filters.area ? eq(core_audit_logs.area, filters.area) : undefined,
    filters.staff === "moderator"
      ? eq(core_audit_logs.area, "moderator")
      : undefined,
    filters.staff === "admin"
      ? ne(core_audit_logs.area, "moderator")
      : undefined,
    filters.pluginId
      ? eq(core_audit_logs.pluginId, filters.pluginId)
      : undefined,
    filters.targetType
      ? eq(core_audit_logs.targetType, filters.targetType)
      : undefined,
    filters.targetId
      ? eq(core_audit_logs.targetId, filters.targetId)
      : undefined,
    filters.from
      ? gte(core_audit_logs.createdAt, startOfDay(filters.from))
      : undefined,
    filters.to
      ? lt(
          core_audit_logs.createdAt,
          new Date(startOfDay(filters.to).getTime() + 86_400_000),
        )
      : undefined,
  ];

  const term = filters.search?.trim();
  if (term) {
    const pattern = containsLikePattern(term);
    conditions.push(
      or(
        ilike(core_audit_logs.targetLabel, pattern),
        ilike(core_audit_logs.action, pattern),
        ilike(core_audit_logs.actorName, pattern),
      ),
    );
  }

  return conditions.filter((condition): condition is SQL => !!condition);
};

const encodeCursor = (createdAt: Date, id: number): string =>
  Buffer.from(JSON.stringify([createdAt.toISOString(), id])).toString(
    "base64url",
  );

const decodeCursor = (cursor: string): { createdAt: Date; id: number } => {
  try {
    const [createdAt, id] = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as [unknown, unknown];
    const date = new Date(String(createdAt));
    if (
      typeof id === "number" &&
      Number.isSafeInteger(id) &&
      !Number.isNaN(date.getTime())
    ) {
      return { createdAt: date, id };
    }
  } catch {
    // Reported below, as every other malformed cursor is.
  }

  throw new HTTPException(400, { message: "Invalid cursor." });
};

const listSelection = {
  action: core_audit_logs.action,
  actorId: core_audit_logs.actorId,
  actorName: core_audit_logs.actorName,
  actorType: core_audit_logs.actorType,
  area: core_audit_logs.area,
  contentTypeId: core_audit_logs.contentTypeId,
  createdAt: core_audit_logs.createdAt,
  currentName: core_users.name,
  id: core_audit_logs.id,
  nameCode: core_users.nameCode,
  pluginId: core_audit_logs.pluginId,
  revisionId: core_audit_logs.revisionId,
  roleColor: core_roles.color,
  rolePrefix: core_roles.prefix,
  scopeFamily: core_audit_logs.scopeFamily,
  scopeId: core_audit_logs.scopeId,
  targetId: core_audit_logs.targetId,
  targetLabel: core_audit_logs.targetLabel,
  targetType: core_audit_logs.targetType,
};

/** A row of {@link listSelection}: the actor's account columns are `null` once it is gone. */
interface ListRow {
  action: string;
  actorId: null | number;
  actorName: null | string;
  actorType: AuditActorType;
  area: AuditArea;
  contentTypeId: null | string;
  createdAt: Date;
  currentName: null | string;
  id: number;
  nameCode: null | string;
  pluginId: string;
  revisionId: null | number;
  roleColor: null | string;
  rolePrefix: null | string;
  scopeFamily: null | string;
  scopeId: null | string;
  targetId: null | string;
  targetLabel: null | string;
  targetType: string;
}

const toListEntry = (row: ListRow): AuditListEntry => ({
  action: row.action,
  actor:
    row.actorId !== null && row.currentName !== null
      ? {
          id: row.actorId,
          name: row.currentName,
          nameCode: row.nameCode ?? "",
          roleColor: row.roleColor,
          rolePrefix: row.rolePrefix,
        }
      : null,
  actorName: row.actorName,
  actorType: row.actorType,
  area: row.area,
  contentTypeId: row.contentTypeId,
  createdAt: row.createdAt,
  id: row.id,
  pluginId: row.pluginId,
  revisionId: row.revisionId,
  scope:
    row.scopeFamily && row.scopeId
      ? { family: row.scopeFamily, id: row.scopeId }
      : null,
  target: {
    id: row.targetId,
    label: row.targetLabel,
    type: row.targetType,
  },
});

interface AuditPageArgs {
  cursor?: string;
  filters: AuditFilters;
  first?: number;
}

/**
 * One page of entries, newest first, by keyset on `(createdAt, id)` - the
 * index the table leads with - so a deep page costs what the first one does
 * and nothing ever counts the whole table.
 */
export const listAuditLogs = async (
  c: Context,
  args: AuditPageArgs,
): Promise<z.infer<typeof zodAuditPage>> => {
  const { edges, pageInfo } = await listAuditLogsWithDetails(c, args);

  return {
    edges: edges.map(
      ({ changes: _changes, metadata: _metadata, ...entry }) => entry,
    ),
    pageInfo,
  };
};

/**
 * {@link listAuditLogs}, with each entry's changes and metadata - already
 * sanitized and bounded when written, so a short history can show them
 * inline. Never the IP address or the correlation id.
 */
export const listAuditLogsWithDetails = async (
  c: Context,
  { cursor, filters, first = AUDIT_DEFAULT_PAGE_SIZE }: AuditPageArgs,
): Promise<z.infer<typeof zodAuditEntityPage>> => {
  const conditions = auditFilterConditions(filters);
  if (cursor) {
    const after = decodeCursor(cursor);
    conditions.push(
      sql`(${core_audit_logs.createdAt}, ${core_audit_logs.id}) < (${after.createdAt}, ${after.id})`,
    );
  }

  const rows = await c
    .get("db")
    .select({
      ...listSelection,
      changes: core_audit_logs.changes,
      metadata: core_audit_logs.metadata,
    })
    .from(core_audit_logs)
    .leftJoin(core_users, eq(core_users.id, core_audit_logs.actorId))
    .leftJoin(core_roles, eq(core_roles.id, core_users.roleId))
    .where(and(...conditions))
    .orderBy(desc(core_audit_logs.createdAt), desc(core_audit_logs.id))
    .limit(first + 1);

  const page = rows.slice(0, first);
  const last = page.at(-1);

  return {
    edges: page.map(row => ({
      ...toListEntry(row),
      changes: row.changes,
      metadata: row.metadata,
    })),
    pageInfo: {
      endCursor: last ? encodeCursor(last.createdAt, last.id) : null,
      hasNextPage: rows.length > first,
    },
  };
};

/** Rows for an export, newest first, bounded by `limit`. */
export const exportAuditLogs = async (
  c: Context,
  { filters, limit }: { filters: AuditFilters; limit: number },
) =>
  await c
    .get("db")
    .select({
      action: core_audit_logs.action,
      actorId: core_audit_logs.actorId,
      actorName: core_audit_logs.actorName,
      actorType: core_audit_logs.actorType,
      area: core_audit_logs.area,
      changes: core_audit_logs.changes,
      createdAt: core_audit_logs.createdAt,
      id: core_audit_logs.id,
      ipAddress: core_audit_logs.ipAddress,
      pluginId: core_audit_logs.pluginId,
      scopeFamily: core_audit_logs.scopeFamily,
      scopeId: core_audit_logs.scopeId,
      targetId: core_audit_logs.targetId,
      targetLabel: core_audit_logs.targetLabel,
      targetType: core_audit_logs.targetType,
    })
    .from(core_audit_logs)
    .where(and(...auditFilterConditions(filters)))
    .orderBy(desc(core_audit_logs.createdAt), desc(core_audit_logs.id))
    .limit(limit);

/** One entry with its changes and metadata, or `null` when it does not exist. */
export const findAuditLog = async (
  c: Context,
  id: number,
): Promise<
  | (AuditListEntry & {
      changes: AuditChanges | null;
      correlationId: null | string;
      ipAddress: null | string;
      metadata: Record<string, unknown>;
    })
  | null
> => {
  const [row] = await c
    .get("db")
    .select({
      ...listSelection,
      changes: core_audit_logs.changes,
      correlationId: core_audit_logs.correlationId,
      ipAddress: core_audit_logs.ipAddress,
      metadata: core_audit_logs.metadata,
    })
    .from(core_audit_logs)
    .leftJoin(core_users, eq(core_users.id, core_audit_logs.actorId))
    .leftJoin(core_roles, eq(core_roles.id, core_users.roleId))
    .where(eq(core_audit_logs.id, id))
    .limit(1);
  if (!row) return null;

  return {
    ...toListEntry(row),
    changes: row.changes,
    correlationId: row.correlationId,
    ipAddress: row.ipAddress,
    metadata: row.metadata,
  };
};
