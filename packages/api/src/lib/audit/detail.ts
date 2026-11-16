import type { Context } from "hono";

import { and, desc, eq, isNull, lt } from "drizzle-orm";

import type { ContentAnyRevisionSnapshot } from "@/content/revisions";
import type { AnyContentTypeDefinition } from "@/content/types";

import { contentIdFromKey } from "@/content/ids";
import { contentAdminHref, contentEditHref } from "@/content/registry";
import { contentDefinitionOf, findContentModel } from "@/content/server/model";
import { core_content_revisions } from "@/database/content";
import { AUDIT_CORE_PLUGIN_ID } from "@/lib/audit/const";
import { sanitizeAuditValue } from "@/lib/audit/sanitize";

import type { AuditDetail, findAuditLog } from "./query";

import { checkStaffPermission } from "../check-staff-permission";

type FoundEntry = NonNullable<Awaited<ReturnType<typeof findAuditLog>>>;

const sameValue = (before: unknown, after: unknown): boolean =>
  JSON.stringify(before ?? null) === JSON.stringify(after ?? null);

/** A content type's definition and plugin, or `null` when it is gone or the admin may not view it. */
export const viewableContentType = async (
  c: Context,
  contentTypeId: string,
): Promise<null | {
  definition: AnyContentTypeDefinition;
  pluginId: string;
}> => {
  const registered = findContentModel(
    c.get("core").contentModels,
    contentTypeId,
  );
  if (!registered) return null;
  const definition = contentDefinitionOf(registered.model);
  const allowed = await checkStaffPermission(c, {
    module: definition.permissionModule,
    permission: "can_view",
    plugin: registered.pluginId,
    type: "admin",
  });

  return allowed ? { definition, pluginId: registered.pluginId } : null;
};

/**
 * The revision a content entry points at, diffed against the one before it -
 * read from the Content Revisions the write already stored, never copied into
 * the audit entry. `available: false` when the revision has been pruned, the
 * content type is gone, or the viewer may not read the content type.
 */
const revisionOf = async (
  c: Context,
  entry: FoundEntry,
): Promise<AuditDetail["revision"]> => {
  if (!entry.contentTypeId || entry.revisionId === null) return null;
  const unavailable = {
    available: false,
    fields: [],
    operation: null,
    version: null,
  };

  const viewable = await viewableContentType(c, entry.contentTypeId);
  if (!viewable) return unavailable;
  const { definition } = viewable;

  const db = c.get("db");
  const [revision] = await db
    .select()
    .from(core_content_revisions)
    .where(
      and(
        eq(core_content_revisions.id, entry.revisionId),
        eq(core_content_revisions.contentTypeId, definition.id),
      ),
    )
    .limit(1);
  if (!revision) return unavailable;

  const [previous] = await db
    .select({ snapshot: core_content_revisions.snapshot })
    .from(core_content_revisions)
    .where(
      and(
        eq(core_content_revisions.contentTypeId, definition.id),
        eq(core_content_revisions.itemId, revision.itemId),
        revision.languageId === null
          ? isNull(core_content_revisions.languageId)
          : eq(core_content_revisions.languageId, revision.languageId),
        lt(core_content_revisions.version, revision.version),
      ),
    )
    .orderBy(desc(core_content_revisions.version))
    .limit(1);

  const after = revision.snapshot.fields;
  const before = (previous?.snapshot as ContentAnyRevisionSnapshot | undefined)
    ?.fields;
  const excluded = new Set(definition.audit.excludeFields);
  const names = [
    ...new Set(revision.changedFields.map(path => path.split(".")[0])),
  ].filter(name => !excluded.has(name));

  return {
    available: true,
    fields: names
      .filter(
        name => before === undefined || !sameValue(before[name], after[name]),
      )
      .map(name => ({
        // Bounded like every audit value: a rich-text document is a marker
        // here, and the revision history panel is where it is read in full.
        after: sanitizeAuditValue(after[name]) ?? null,
        before:
          before === undefined
            ? null
            : (sanitizeAuditValue(before[name]) ?? null),
        name,
      })),
    operation: revision.operation,
    version: revision.version,
  };
};

/**
 * Where the target lives in the AdminCP, when the viewer may open it: the user
 * or the content record. `null` for anything else - a deleted target answers 404 there
 * anyway, and no plugin code is run to work a path out.
 */
const targetHrefOf = async (
  c: Context,
  entry: FoundEntry,
): Promise<null | string> => {
  const { id, type } = entry.target;
  if (id === null) return null;

  if (type === "user") {
    const allowed = await checkStaffPermission(c, {
      module: "users",
      permission: "can_view",
      plugin: AUDIT_CORE_PLUGIN_ID,
      type: "admin",
    });

    return allowed ? `/admin/core/users/${id}` : null;
  }

  if (entry.contentTypeId && type === entry.contentTypeId) {
    const viewable = await viewableContentType(c, entry.contentTypeId);
    if (!viewable) return null;
    const { definition } = viewable;
    const itemId = contentIdFromKey(definition.idStrategy, id);
    if (
      itemId !== null &&
      definition.admin.edit.mode === "page" &&
      entry.action !== "content.deleted"
    ) {
      return contentEditHref(definition, itemId);
    }

    return contentAdminHref(definition);
  }

  return null;
};

/**
 * One entry as the detail sheet shows it. Sensitive technical metadata (IP
 * address, correlation id) only with `canViewSensitive`.
 */
export const auditDetailOf = async (
  c: Context,
  entry: FoundEntry,
  { canViewSensitive }: { canViewSensitive: boolean },
): Promise<AuditDetail> => ({
  ...entry,
  correlationId: canViewSensitive ? entry.correlationId : null,
  ipAddress: canViewSensitive ? entry.ipAddress : null,
  revision: await revisionOf(c, entry),
  targetHref: await targetHrefOf(c, entry),
});
