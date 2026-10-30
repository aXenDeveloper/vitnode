import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, inArray } from "drizzle-orm";

import type { ContentId } from "../../ids";
import type { AnyContentModel } from "../../server/model";
import type { ContentAccessActor } from "../policy";
import type { ContentAccessScopeRef } from "./source";

import { contentIdKey, parseContentId } from "../../ids";
import { contentDefinitionOf } from "../../server/model";
import { resolveContentAccessActor } from "./actor";
import {
  contentAccessAllowedScopes,
  listContentAccessFamilies,
  loadContentAccessFamilyState,
} from "./families";
import {
  contentAccessCondition,
  contentAccessSourceOf,
  contentRecordAccessScopes,
} from "./source";

/** How a scope is written into the search index: `family:scopeId`. */
export const contentSearchAccessToken = ({
  family,
  scopeId,
}: ContentAccessScopeRef): string => `${family}:${scopeId}`;

const modelOf = (c: Context, itemType: string): AnyContentModel | undefined =>
  ((c.get("core")?.contentModels ?? []) as { model: AnyContentModel }[]).find(
    entry => entry.model.definition.id === itemType,
  )?.model;

/**
 * Stamps each document of an access-controlled content type with the scopes
 * its record is filed in right now, read from the database. Every index write
 * goes through here, whatever built the document. Server-only.
 */
export const withContentSearchAccessScopes = async <
  TDoc extends {
    accessScopes?: readonly string[];
    itemId: ContentId;
    itemType: string;
  },
>(
  c: Context,
  docs: readonly TDoc[],
): Promise<TDoc[]> => {
  const byType = new Map<string, TDoc[]>();
  for (const doc of docs) {
    byType.set(doc.itemType, [...(byType.get(doc.itemType) ?? []), doc]);
  }

  const scopesByKey = new Map<string, string[]>();
  for (const [itemType, group] of byType) {
    const model = modelOf(c, itemType);
    if (!model || !contentAccessSourceOf(c, model)) continue;

    const scopes = await contentRecordAccessScopes(
      c,
      model,
      group.map(doc => doc.itemId),
    );
    for (const doc of group) {
      const refs = scopes.get(contentIdKey(doc.itemId));
      // A record the database no longer has belongs to no scope anybody may
      // read: the token names nothing.
      scopesByKey.set(
        `${itemType}|${contentIdKey(doc.itemId)}`,
        refs
          ? refs.map(contentSearchAccessToken)
          : [`:missing:${contentIdKey(doc.itemId)}`],
      );
    }
  }

  return docs.map(doc => {
    const tokens = scopesByKey.get(
      `${doc.itemType}|${contentIdKey(doc.itemId)}`,
    );

    return tokens ? { ...doc, accessScopes: tokens } : doc;
  });
};

/**
 * The scope tokens the viewer may read, for a search query: a document is
 * kept only when every token it carries is in the list. `null` when nothing
 * restricts the viewer (no access families, or a root role) - no filter at
 * all. Server-only.
 */
export const contentSearchAllowedScopes = async (
  c: Context,
  actor?: ContentAccessActor,
): Promise<null | string[]> => {
  const who = actor ?? (await resolveContentAccessActor(c));
  if (who.kind === "member" && who.root) return null;

  const families = listContentAccessFamilies(c);
  if (families.length === 0) return null;

  const tokens: string[] = [];
  let restricted = false;
  for (const family of families) {
    const allowed = await contentAccessAllowedScopes(c, {
      action: "read",
      actor: who,
      family,
    });
    if (!allowed.all) restricted = true;
    // Every scope of a fully open family too: the filter is "all of a
    // document's scopes are allowed", so an open family's scopes must be in it.
    const ids = allowed.all
      ? [...(await loadContentAccessFamilyState(c, family)).parents.keys()]
      : allowed.ids;
    for (const id of ids) tokens.push(`${family.id}:${id}`);
  }

  return restricted ? tokens : null;
};

/**
 * Which of `hits` the viewer may read, checked against the content tables now
 * - not against what the index remembers. A document indexed before its
 * record moved into a restricted scope, or before a role was taken away, is
 * dropped here. Hits of item types without access rules pass. Server-only.
 */
export const verifyContentSearchHits = async <
  THit extends { itemId: ContentId | string; itemType: string },
>(
  c: Context,
  hits: readonly THit[],
): Promise<{ dropped: THit[]; kept: THit[] }> => {
  const actor = await resolveContentAccessActor(c);
  if (actor.kind === "member" && actor.root)
    return { dropped: [], kept: [...hits] };

  const readable = new Map<string, Set<string>>();
  const types = [...new Set(hits.map(hit => hit.itemType))];
  for (const itemType of types) {
    const model = modelOf(c, itemType);
    if (!model || !contentAccessSourceOf(c, model)) continue;

    const condition = await contentAccessCondition(c, model, "read", actor);
    const ids = hits
      .filter(hit => hit.itemType === itemType)
      .flatMap(hit => {
        const id = parseContentId(
          contentDefinitionOf(model).idStrategy,
          hit.itemId,
        );

        return id === null ? [] : [id];
      });
    if (!condition) {
      readable.set(itemType, new Set(ids.map(id => contentIdKey(id))));
      continue;
    }
    const columns = model.columns as Record<string, PgColumn>;
    const table: PgTable = model.table;
    const rows =
      ids.length === 0
        ? []
        : await c
            .get("db")
            .select({ id: columns.id })
            .from(table)
            .where(and(inArray(columns.id, ids), condition));
    readable.set(
      itemType,
      new Set(rows.map(row => contentIdKey(row.id as ContentId))),
    );
  }

  const kept: THit[] = [];
  const dropped: THit[] = [];
  for (const hit of hits) {
    const allowed = readable.get(hit.itemType);
    if (!allowed || allowed.has(contentIdKey(hit.itemId))) {
      kept.push(hit);
    } else {
      dropped.push(hit);
    }
  }

  return { dropped, kept };
};
