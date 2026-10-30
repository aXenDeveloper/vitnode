import type { Context } from "hono";

import type {
  ContentAccessAction,
  ContentAccessAudience,
  ContentAccessOverrides,
  ContentAccessRequirement,
  ContentAccessRuleSource,
} from "../policy";
import type { ContentAccessScopeReport } from "../schemas";
import type { ContentAccessFamily } from "./families";

import { CONTENT_ACCESS_ACTIONS, CONTENT_ACCESS_PREREQUISITES } from "../const";
import { resolveContentAccessRules } from "../policy";
import {
  contentAccessChainOf,
  contentAccessScopeRequirements,
  loadContentAccessFamilyState,
} from "./families";

interface ActionReport {
  effective: ContentAccessAudience;
  inherited: ContentAccessAudience;
  inheritedSource: ContentAccessRuleSource;
  prerequisite: ContentAccessAction | null;
  requirements: ContentAccessRequirement[];
  source: ContentAccessRuleSource;
}

/**
 * One scope's own rules, what it inherits, and every requirement that applies
 * once its ancestors are counted - for the AdminCP, which explains *why* a
 * scope is restricted rather than only listing roles. `null` for a scope that
 * does not exist. Server-only.
 */
export type { ContentAccessScopeReport } from "../schemas";

export const contentAccessScopeReport = async (
  c: Context,
  family: ContentAccessFamily,
  scopeId: string,
  /** Rules to preview instead of the stored ones, before saving them. */
  preview?: ContentAccessOverrides,
): Promise<ContentAccessScopeReport | null> => {
  const loaded = await loadContentAccessFamilyState(c, family);
  const state = preview
    ? {
        ...loaded,
        rules: new Map(loaded.rules).set(scopeId, preview),
      }
    : loaded;
  const chain = contentAccessChainOf(state, scopeId);
  if (!chain) return null;

  const own = resolveContentAccessRules({ chain, defaults: family.defaults });
  const inherited = resolveContentAccessRules({
    chain: chain.slice(1),
    defaults: family.defaults,
  });

  const actions = Object.fromEntries(
    CONTENT_ACCESS_ACTIONS.map(action => [
      action,
      {
        effective: own.policy[action],
        inherited: inherited.policy[action],
        inheritedSource: inherited.sources[action],
        prerequisite: CONTENT_ACCESS_PREREQUISITES[action],
        requirements: contentAccessScopeRequirements(state, scopeId, action),
        source: own.sources[action],
      } satisfies ActionReport,
    ]),
  ) as Record<ContentAccessAction, ActionReport>;

  const children = new Map<string, string[]>();
  for (const [id, parent] of state.parents) {
    if (parent === null) continue;
    children.set(parent, [...(children.get(parent) ?? []), id]);
  }
  let descendants = 0;
  const stack = [...(children.get(scopeId) ?? [])];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const next = stack.pop();
    if (next === undefined || seen.has(next)) continue;
    seen.add(next);
    descendants++;
    stack.push(...(children.get(next) ?? []));
  }

  const warnings = CONTENT_ACCESS_ACTIONS.flatMap(action =>
    actions[action].requirements.flatMap(requirement =>
      requirement.audience.mode === "roles" &&
      requirement.audience.roleIds.length === 0
        ? [{ action, kind: "nobody" as const, scopeId: requirement.scopeId }]
        : [],
    ),
  );

  return {
    actions,
    descendants,
    family: family.id,
    overrides: state.rules.get(scopeId) ?? {},
    scopeId,
    warnings,
  };
};
