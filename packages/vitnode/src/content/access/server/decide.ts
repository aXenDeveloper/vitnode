import type { SQL } from "drizzle-orm";
import type { Context } from "hono";

import type { ContentId } from "../../ids";
import type { AnyContentModel } from "../../server/model";
import type {
  ContentAccessAction,
  ContentAccessActor,
  ContentAccessDecision,
  ContentAccessFlags,
  ContentAccessRequirement,
} from "../policy";
import type { ContentAccessAllowedScopes } from "./families";
import type { ContentAccessScopeRef } from "./source";

import { contentIdKey } from "../../ids";
import { CONTENT_ACCESS_ACTIONS } from "../const";
import {
  CONTENT_ACCESS_DENY_ALL,
  contentAccessFlagKey,
  decideContentAccess,
} from "../policy";
import { resolveContentAccessActor } from "./actor";
import {
  contentAccessAllowedScopes,
  contentAccessScopeRequirements,
  findContentAccessFamily,
  loadContentAccessFamilyState,
} from "./families";
import {
  contentAccessCondition,
  contentAccessScopesForValues,
  contentAccessSourceOf,
  contentRecordAccessScopes,
  isContentAccessOpen,
} from "./source";

/**
 * Everything `scopes` ask of an actor for `action`, together. A record in two
 * scopes needs both: this is an intersection, even though one scope's `roles`
 * audience lets in any of its roles.
 */
export const contentAccessRequirementsForScopes = async (
  c: Context,
  scopes: readonly ContentAccessScopeRef[],
  action: ContentAccessAction,
): Promise<ContentAccessRequirement[]> => {
  const requirements: ContentAccessRequirement[] = [];
  for (const scope of scopes) {
    const family = findContentAccessFamily(c, scope.family);
    if (!family) {
      // A scope of a family that is gone, or a parent that no longer exists.
      requirements.push({
        action,
        audience: CONTENT_ACCESS_DENY_ALL,
        family: scope.family,
        scopeId: scope.scopeId,
        source: { kind: "fallback" },
        via: "self",
      });
      continue;
    }

    const state = await loadContentAccessFamilyState(c, family);
    requirements.push(
      ...contentAccessScopeRequirements(state, scope.scopeId, action),
    );
  }

  return requirements;
};

/** One decision for `action` over every scope in `scopes`. */
export const decideContentAccessForScopes = async (
  c: Context,
  {
    action,
    actor,
    scopes,
  }: {
    action: ContentAccessAction;
    actor?: ContentAccessActor;
    scopes: readonly ContentAccessScopeRef[];
  },
): Promise<ContentAccessDecision> =>
  decideContentAccess(
    actor ?? (await resolveContentAccessActor(c)),
    await contentAccessRequirementsForScopes(c, scopes, action),
  );

/** The four flags for one set of scopes. */
export const contentAccessFlagsForScopes = async (
  c: Context,
  {
    actor,
    scopes,
  }: { actor?: ContentAccessActor; scopes: readonly ContentAccessScopeRef[] },
): Promise<ContentAccessFlags & { denied: Partial<Record<ContentAccessAction, ContentAccessRequirement>> }> => {
  const who = actor ?? (await resolveContentAccessActor(c));
  const flags: Record<string, boolean> = {};
  const denied: Partial<Record<ContentAccessAction, ContentAccessRequirement>> =
    {};
  for (const action of CONTENT_ACCESS_ACTIONS) {
    const decision = decideContentAccess(
      who,
      await contentAccessRequirementsForScopes(c, scopes, action),
    );
    flags[contentAccessFlagKey[action]] = decision.allowed;
    if (!decision.allowed) denied[action] = decision.requirement;
  }

  return {
    ...(flags as unknown as ContentAccessFlags),
    denied,
  };
};

/**
 * Each record's flags, from the scopes it belongs to right now. A record
 * missing from the map does not exist. Server-only.
 */
export const contentRecordAccessFlags = async (
  c: Context,
  model: AnyContentModel,
  ids: readonly ContentId[],
  actor?: ContentAccessActor,
): Promise<Map<string, ContentAccessFlags>> => {
  const scopes = await contentRecordAccessScopes(c, model, ids);
  const who = actor ?? (await resolveContentAccessActor(c));
  const result = new Map<string, ContentAccessFlags>();
  for (const [key, refs] of scopes) {
    const { denied: _denied, ...flags } = await contentAccessFlagsForScopes(c, {
      actor: who,
      scopes: refs,
    });
    result.set(key, flags);
  }

  return result;
};

/** Whether `actor` may perform `action` on one record. `false` when it does not exist. */
export const canAccessContentRecord = async (
  c: Context,
  {
    action,
    actor,
    id,
    model,
  }: {
    action: ContentAccessAction;
    actor?: ContentAccessActor;
    id: ContentId;
    model: AnyContentModel;
  },
): Promise<boolean> => {
  if (!contentAccessSourceOf(c, model)) return true;
  const scopes = (await contentRecordAccessScopes(c, model, [id])).get(
    contentIdKey(id),
  );
  if (!scopes) return false;

  return (await decideContentAccessForScopes(c, { action, actor, scopes }))
    .allowed;
};

/**
 * The server-side access API for one request: who is asking, what they may
 * do with a record or a scope, and the SQL that limits a custom query to the
 * records they may read. Every decision reads the current roles, rules and
 * scope tree; nothing a client sent is trusted. Server-only.
 *
 * Root roles pass every rule. Staff permissions grant nothing here: a
 * moderator reads a restricted scope on the public site only when an access
 * rule lets one of their roles in.
 *
 * @example
 * ```ts
 * import { createContentAccess } from "@vitnode/core/content/server";
 *
 * const access = createContentAccess(c);
 * const where = await access.condition(topicContent, "read");
 * const rows = await c.get("db").select().from(topics).where(where);
 * ```
 */
export const createContentAccess = (c: Context) => ({
  /** The current viewer, resolved once per request. */
  actor: async (): Promise<ContentAccessActor> =>
    await resolveContentAccessActor(c),
  /** The scopes of one family that allow `action`. */
  allowedScopes: async (
    familyId: string,
    action: ContentAccessAction,
  ): Promise<ContentAccessAllowedScopes> => {
    const family = findContentAccessFamily(c, familyId);
    if (!family) return { all: true, ids: [] };

    return await contentAccessAllowedScopes(c, {
      action,
      actor: await resolveContentAccessActor(c),
      family,
    });
  },
  /** Whether the viewer may perform `action` on one record. */
  canRecord: async (
    model: AnyContentModel,
    id: ContentId,
    action: ContentAccessAction,
  ): Promise<boolean> =>
    await canAccessContentRecord(c, { action, id, model }),
  /** Whether the viewer may perform `action` in one scope of a family. */
  canScope: async (
    familyId: string,
    scopeId: number | string,
    action: ContentAccessAction,
  ): Promise<boolean> =>
    (
      await decideContentAccessForScopes(c, {
        action,
        scopes: [{ family: familyId, scopeId: String(scopeId) }],
      })
    ).allowed,
  /** A `WHERE` condition limiting `model`'s rows to what the viewer may act on, or `undefined`. */
  condition: async (
    model: AnyContentModel,
    action: ContentAccessAction,
  ): Promise<SQL | undefined> =>
    await contentAccessCondition(c, model, action),
  /** Flags per record id key. */
  flags: async (
    model: AnyContentModel,
    ids: readonly ContentId[],
  ): Promise<Map<string, ContentAccessFlags>> =>
    await contentRecordAccessFlags(c, model, ids),
  /** Whether no rule can change what anybody reads of `model`: safe to share a cache. */
  isOpen: async (model: AnyContentModel): Promise<boolean> =>
    await isContentAccessOpen(c, model),
  /** The scopes a record would belong to with these values. */
  scopesFor: async (
    model: AnyContentModel,
    values: Record<string, unknown>,
  ): Promise<ContentAccessScopeRef[] | null> =>
    await contentAccessScopesForValues(c, model, values),
});

export type ContentAccess = ReturnType<typeof createContentAccess>;
