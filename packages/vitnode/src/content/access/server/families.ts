import type { Context } from "hono";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { eq } from "drizzle-orm";

import type { AnyContentContainerDefinition } from "../../containers/types";
import type { AnyContentModel } from "../../server/model";
import type {
  ContentAccessAction,
  ContentAccessActor,
  ContentAccessDefaultsInput,
  ContentAccessRequirement,
  ContentAccessScopeLayer,
} from "../policy";
import type { ContentAccessRuleMap } from "./rules";

import { core_content_containers } from "../../../database/content-containers";
import { CONTENT_ACCESS_ACTIONS } from "../const";
import {
  CONTENT_ACCESS_DENY_ALL,
  contentAccessRequirements,
  decideContentAccess,
  isContentAccessAudienceOpen,
} from "../policy";
import { loadContentAccessRules } from "./rules";

/**
 * A set of access scopes that share one rule store: a container collection
 * (`kind: "container"`, nested) or a content type declared with
 * `access: { scope }` (`kind: "contentType"`, flat).
 */
export interface ContentAccessFamily {
  container?: AnyContentContainerDefinition;
  defaults: ContentAccessDefaultsInput;
  id: string;
  kind: "container" | "contentType";
  model?: AnyContentModel;
  pluginId: string;
}

/** Every access-enabled scope family of the running app. */
export const listContentAccessFamilies = (c: Context): ContentAccessFamily[] => {
  const core = c.get("core") as
    | undefined
    | {
        contentContainers?: {
          definition: AnyContentContainerDefinition;
          pluginId: string;
        }[];
        contentModels?: { model: AnyContentModel; pluginId: string }[];
      };

  return [
    ...(core?.contentContainers ?? []).flatMap(({ definition, pluginId }) =>
      definition.access?.enabled
        ? [
            {
              container: definition,
              defaults: definition.access.defaults,
              id: definition.id,
              kind: "container" as const,
              pluginId,
            },
          ]
        : [],
    ),
    ...(core?.contentModels ?? []).flatMap(({ model, pluginId }) =>
      model.definition.access?.scope.enabled
        ? [
            {
              defaults: model.definition.access.scope.defaults,
              id: model.definition.id,
              kind: "contentType" as const,
              model,
              pluginId,
            },
          ]
        : [],
    ),
  ];
};

export const findContentAccessFamily = (
  c: Context,
  id: string,
): ContentAccessFamily | undefined =>
  listContentAccessFamilies(c).find(family => family.id === id);

/** One family's structure and rules, as one request sees them. */
export interface ContentAccessFamilyState {
  family: ContentAccessFamily;
  /** Scope id -> parent scope id (`null` at the root). */
  parents: Map<string, null | string>;
  rules: ContentAccessRuleMap;
}

const states = new WeakMap<
  Context,
  Map<string, Promise<ContentAccessFamilyState>>
>();

const loadScopes = async (
  c: Context,
  family: ContentAccessFamily,
): Promise<Map<string, null | string>> => {
  // Read live, not from the cached container tree: a move has to change who
  // may read a subtree on the very next request.
  if (family.kind === "container") {
    const rows = await c
      .get("db")
      .select({
        id: core_content_containers.id,
        parentId: core_content_containers.parentId,
      })
      .from(core_content_containers)
      .where(eq(core_content_containers.definitionId, family.id));

    return new Map(
      rows.map(row => [
        String(row.id),
        row.parentId === null ? null : String(row.parentId),
      ]),
    );
  }

  const model = family.model;
  if (!model) return new Map();
  const columns = model.columns as Record<string, PgColumn>;
  const table: PgTable = model.table;
  const rows = await c.get("db").select({ id: columns.id }).from(table);

  return new Map(rows.map(row => [String(row.id), null]));
};

export const loadContentAccessFamilyState = async (
  c: Context,
  family: ContentAccessFamily,
): Promise<ContentAccessFamilyState> => {
  let memo = states.get(c);
  if (!memo) {
    memo = new Map();
    states.set(c, memo);
  }

  const remembered = memo.get(family.id);
  if (remembered) return await remembered;

  const promise = (async () => {
    const [parents, rules] = await Promise.all([
      loadScopes(c, family),
      loadContentAccessRules(c, family.id),
    ]);

    return { family, parents, rules };
  })();
  memo.set(family.id, promise);

  return await promise;
};

/** Drops every state this request read, after it changed rules or scopes. */
export const forgetContentAccessFamilyStates = (c: Context): void => {
  states.delete(c);
};

/** The scope then its ancestors, nearest first, or `null` for an unknown scope. */
export const contentAccessChainOf = (
  state: ContentAccessFamilyState,
  scopeId: string,
): ContentAccessScopeLayer[] | null => {
  if (!state.parents.has(scopeId)) return null;

  const chain: ContentAccessScopeLayer[] = [];
  const seen = new Set<string>();
  let next: null | string = scopeId;
  while (next !== null && !seen.has(next) && state.parents.has(next)) {
    seen.add(next);
    chain.push({ id: next, overrides: state.rules.get(next) ?? {} });
    next = state.parents.get(next) ?? null;
  }

  return chain;
};

/**
 * What one scope asks of an actor for `action`. A scope that does not exist
 * (deleted, or an id nobody resolved) asks for something nobody has, so it
 * never reads as open.
 */
export const contentAccessScopeRequirements = (
  state: ContentAccessFamilyState,
  scopeId: string,
  action: ContentAccessAction,
): ContentAccessRequirement[] => {
  const chain = contentAccessChainOf(state, scopeId);
  if (!chain) {
    return [
      {
        action,
        audience: CONTENT_ACCESS_DENY_ALL,
        family: state.family.id,
        scopeId,
        source: { kind: "fallback" },
        via: "self",
      },
    ];
  }

  return contentAccessRequirements({
    action,
    chain,
    defaults: state.family.defaults,
    family: state.family.id,
  });
};

/** Which scopes of a family allow `action` for `actor`. */
export interface ContentAccessAllowedScopes {
  /** Every existing scope allows it. */
  all: boolean;
  ids: string[];
}

const allowedMemos = new WeakMap<
  Context,
  Map<string, ContentAccessAllowedScopes>
>();

const actorKey = (actor: ContentAccessActor): string =>
  actor.kind === "guest"
    ? "guest"
    : `${actor.userId}:${actor.root ? "root" : actor.roleIds.join(",")}`;

export const contentAccessAllowedScopes = async (
  c: Context,
  {
    action,
    actor,
    family,
  }: {
    action: ContentAccessAction;
    actor: ContentAccessActor;
    family: ContentAccessFamily;
  },
): Promise<ContentAccessAllowedScopes> => {
  let memo = allowedMemos.get(c);
  if (!memo) {
    memo = new Map();
    allowedMemos.set(c, memo);
  }
  const key = `${family.id}|${action}|${actorKey(actor)}`;
  const remembered = memo.get(key);
  if (remembered) return remembered;

  const state = await loadContentAccessFamilyState(c, family);
  const ids = [...state.parents.keys()].filter(
    id =>
      decideContentAccess(
        actor,
        contentAccessScopeRequirements(state, id, action),
      ).allowed,
  );
  const result = { all: ids.length === state.parents.size, ids };
  memo.set(key, result);

  return result;
};

/**
 * Whether no rule of the family keeps anybody out of anything: every default
 * and every stored rule is open to everyone. Only then is a response built
 * from the family the same for every viewer, and safe to cache for everybody.
 */
export const isContentAccessFamilyOpen = async (
  c: Context,
  family: ContentAccessFamily,
): Promise<boolean> => {
  const defaultsOpen = CONTENT_ACCESS_ACTIONS.every(action => {
    const audience = family.defaults[action];

    return !audience || isContentAccessAudienceOpen(audience);
  });
  if (!defaultsOpen) return false;

  const state = await loadContentAccessFamilyState(c, family);

  return [...state.rules.values()].every(overrides =>
    Object.values(overrides).every(
      audience => !audience || isContentAccessAudienceOpen(audience),
    ),
  );
};

export const forgetContentAccessAllowed = (c: Context): void => {
  allowedMemos.delete(c);
};
