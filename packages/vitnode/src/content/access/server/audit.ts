import type { PgColumn } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq } from "drizzle-orm";

import type { ContentDatabase } from "../../server/service";
import type {
  ContentAccessAction,
  ContentAccessAudience,
  ContentAccessOverrides,
} from "../policy";
import type { ContentAccessFamily } from "./families";

import { roleAuditLabel } from "../../../api/lib/audit/labels";
import { writeAuditLog } from "../../../api/lib/audit/write";
import { core_content_containers } from "../../../database/content-containers";
import { auditDiff } from "../../../lib/audit/diff";
import { contentIdFromKey } from "../../ids";
import { resolveContentAuditLabel } from "../../server/audit";
import { contentDefinitionOf } from "../../server/model";

/** The audit action of a scope whose access rules changed. */
export const CONTENT_ACCESS_UPDATED_AUDIT_ACTION = "content.access_updated";

/** The audit action of public files moved into private storage. */
export const CONTENT_ACCESS_FILES_PROTECTED_AUDIT_ACTION =
  "content.access_files_protected";

/** The changes key of one action's rule, labelled by `core.activity_logs.fields`. */
const fieldOf = (action: ContentAccessAction): string => `access_${action}`;

/**
 * One rule as a stored, language-neutral value: `inherit`, `everyone`,
 * `members`, or `roles: VIP, Staff` with the role names of today, so the entry
 * still reads after a role is renamed or deleted.
 */
const audienceValue = async (
  c: Context,
  audience: ContentAccessAudience | undefined,
): Promise<string> => {
  if (!audience) return "inherit";
  if (audience.mode !== "roles") return audience.mode;
  if (audience.roleIds.length === 0) return "roles: -";
  const names = await Promise.all(
    audience.roleIds.map(
      async roleId => (await roleAuditLabel(c, roleId)) ?? `#${roleId}`,
    ),
  );

  return `roles: ${names.join(", ")}`;
};

/** The scope's name - a container's, or the scope record's title - or `null`. */
const scopeLabel = async (
  c: Context,
  tx: ContentDatabase,
  family: ContentAccessFamily,
  scopeId: string,
): Promise<null | string> => {
  if (family.kind === "container") {
    const id = Number(scopeId);
    if (!Number.isSafeInteger(id)) return null;
    const [row] = await tx
      .select({ name: core_content_containers.name })
      .from(core_content_containers)
      .where(
        and(
          eq(core_content_containers.id, id),
          eq(core_content_containers.definitionId, family.id),
        ),
      )
      .limit(1);

    return row?.name ?? null;
  }

  const model = family.model;
  if (!model) return null;
  const definition = contentDefinitionOf(model);
  const itemId = contentIdFromKey(definition.idStrategy, scopeId);
  if (itemId === null) return null;
  const columns = model.columns as Record<string, PgColumn>;
  const [row] = (await tx
    .select()
    .from(model.table)
    .where(eq(columns.id, itemId))
    .limit(1)) as Record<string, unknown>[];
  const translations = model.translationService;

  return await resolveContentAuditLabel(
    definition,
    row ?? null,
    translations
      ? async () =>
          await translations(c).findByLocale(
            itemId,
            definition.localization.defaultLocale,
            { tx },
          )
      : undefined,
  );
};

/**
 * Records an access-rule change of one scope in the Activity Logs, inside the
 * transaction that saved it: one entry per save, with the before and after
 * rule of every action that changed. Server-only.
 */
export const recordContentAccessUpdate = async (
  c: Context,
  tx: ContentDatabase,
  {
    after,
    before,
    changedActions,
    family,
    scopeId,
  }: {
    after: ContentAccessOverrides;
    before: ContentAccessOverrides;
    changedActions: readonly ContentAccessAction[];
    family: ContentAccessFamily;
    scopeId: string;
  },
): Promise<void> => {
  if (changedActions.length === 0) return;

  const entries = await Promise.all(
    changedActions.map(
      async action =>
        [
          fieldOf(action),
          {
            after: await audienceValue(c, after[action]),
            before: await audienceValue(c, before[action]),
          },
        ] as const,
    ),
  );

  await writeAuditLog(
    c,
    {
      action: CONTENT_ACCESS_UPDATED_AUDIT_ACTION,
      changes: auditDiff({
        after: Object.fromEntries(
          entries.map(([key, { after }]) => [key, after]),
        ),
        before: Object.fromEntries(
          entries.map(([key, { before }]) => [key, before]),
        ),
      }),
      contentTypeId: family.kind === "contentType" ? family.id : null,
      pluginId: family.pluginId,
      target: {
        id: scopeId,
        label: await scopeLabel(c, tx, family, scopeId),
        type: family.id,
      },
    },
    tx,
  );
};

/**
 * Records a "Protect public files" run that moved or skipped anything. The
 * files have already moved - storage is not transactional - so this is written
 * after them.
 */
export const recordContentAccessFilesProtected = async (
  c: Context,
  {
    family,
    result,
  }: {
    family: ContentAccessFamily;
    result: { moved: number; remaining: number; shared: number };
  },
): Promise<void> => {
  if (result.moved === 0 && result.shared === 0) return;

  await writeAuditLog(c, {
    action: CONTENT_ACCESS_FILES_PROTECTED_AUDIT_ACTION,
    contentTypeId: family.kind === "contentType" ? family.id : null,
    metadata: {
      moved: result.moved,
      remaining: result.remaining,
      shared: result.shared,
    },
    pluginId: family.pluginId,
    target: { id: null, label: null, type: family.id },
  });
};
