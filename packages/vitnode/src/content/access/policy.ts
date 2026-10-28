import { z } from "zod";

import {
  CONTENT_ACCESS_ACTIONS,
  CONTENT_ACCESS_MAX_ROLES,
  CONTENT_ACCESS_MODES,
  CONTENT_ACCESS_PREREQUISITES,
} from "./const";

export type ContentAccessAction = (typeof CONTENT_ACCESS_ACTIONS)[number];

export type ContentAccessMode = (typeof CONTENT_ACCESS_MODES)[number];

/**
 * Who one access rule lets in: everyone (guests too), signed-in members, or
 * members holding at least one of `roleIds` as a primary or secondary role.
 * A `roles` audience with no role left in it lets nobody in.
 */
export type ContentAccessAudience =
  | { mode: "everyone" }
  | { mode: "members" }
  | { mode: "roles"; roleIds: number[] };

/** One scope's own rules. A missing action inherits. */
export type ContentAccessOverrides = Partial<
  Record<ContentAccessAction, ContentAccessAudience>
>;

/** A rule for every action, after inheritance. */
export type ContentAccessPolicy = Record<
  ContentAccessAction,
  ContentAccessAudience
>;

/**
 * What a definition may default to. Role ids belong to one installation, so a
 * code default is `everyone` or `members`; roles are picked in the AdminCP.
 */
export type ContentAccessDefaultAudience =
  | { mode: "everyone" }
  | { mode: "members" };

export type ContentAccessDefaultsInput = Partial<
  Record<ContentAccessAction, ContentAccessDefaultAudience>
>;

/** The `access` option of a container collection or a scope content type. */
export interface ContentAccessScopeInput {
  /**
   * What every scope starts with before an administrator overrides it.
   * Omitted actions are open to everyone, so turning access on changes
   * nothing until somebody restricts a scope.
   */
  defaults?: ContentAccessDefaultsInput;
}

export interface ResolvedContentAccessScope {
  defaults: ContentAccessDefaultsInput;
  enabled: boolean;
}

/** Who is asking, resolved on the server from the session and the database. */
export type ContentAccessActor =
  | { kind: "guest" }
  | {
      kind: "member";
      /** Primary and secondary roles, read live for this request. */
      roleIds: readonly number[];
      /** Holds a root role: passes every access rule. */
      root: boolean;
      userId: number;
    };

/** Where an inherited rule came from. */
export type ContentAccessRuleSource =
  | { kind: "default" }
  | { kind: "fallback" }
  | { kind: "scope"; scopeId: string };

/** One scope of a chain: the scope, then its ancestors, nearest first. */
export interface ContentAccessScopeLayer {
  id: string;
  overrides: ContentAccessOverrides;
}

/** One condition an actor must meet for an action. */
export interface ContentAccessRequirement {
  /** The rule's own action, e.g. `view` when an ancestor hides a scope. */
  action: ContentAccessAction;
  audience: ContentAccessAudience;
  /** The scope family the rule belongs to. */
  family: string;
  /** The scope whose effective rule this is. */
  scopeId: string;
  /** Where that scope's rule was inherited from. */
  source: ContentAccessRuleSource;
  /** `ancestor` when a parent of the scope sets it. */
  via: "ancestor" | "self";
}

export type ContentAccessDecision =
  | { allowed: false; requirement: ContentAccessRequirement }
  | { allowed: true; reason: "granted" | "root" };

export const DISABLED_CONTENT_ACCESS_SCOPE: ResolvedContentAccessScope = {
  defaults: {},
  enabled: false,
};

const EVERYONE: ContentAccessAudience = { mode: "everyone" };

/** What a stored rule that no longer parses becomes: nobody. */
export const CONTENT_ACCESS_DENY_ALL: ContentAccessAudience = {
  mode: "roles",
  roleIds: [],
};

const zodRoleIds = z
  .array(z.number().int().positive())
  .min(1)
  .max(CONTENT_ACCESS_MAX_ROLES)
  .transform(ids => [...new Set(ids)].sort((a, b) => a - b));

/** An audience as an administrator saves it: a `roles` audience names a role. */
export const zodContentAccessAudience = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("everyone") }),
  z.strictObject({ mode: z.literal("members") }),
  z.strictObject({ mode: z.literal("roles"), roleIds: zodRoleIds }),
]);

/** What a scope saves: one audience per action it overrides. */
export const zodContentAccessOverrides = z.strictObject(
  Object.fromEntries(
    CONTENT_ACCESS_ACTIONS.map(action => [
      action,
      zodContentAccessAudience.optional(),
    ]),
  ) as Record<
    ContentAccessAction,
    z.ZodOptional<typeof zodContentAccessAudience>
  >,
);

/** An audience as a response carries it, deny-all included. */
export const zodContentAccessAudienceRead = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("everyone") }),
  z.object({ mode: z.literal("members") }),
  z.object({
    mode: z.literal("roles"),
    roleIds: z.array(z.number().int()),
  }),
]);

const zodDefaultAudience = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("everyone") }),
  z.strictObject({ mode: z.literal("members") }),
]);

const zodScopeInput = z.strictObject({
  defaults: z
    .strictObject(
      Object.fromEntries(
        CONTENT_ACCESS_ACTIONS.map(action => [
          action,
          zodDefaultAudience.optional(),
        ]),
      ) as Record<ContentAccessAction, z.ZodOptional<typeof zodDefaultAudience>>,
    )
    .optional(),
});

const compactOverrides = <T extends object>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;

/**
 * Validates the `access` option of a definition. `true` turns access on with
 * every action open to everyone; `false` or nothing leaves it off.
 *
 * @throws {Error} The message the caller wraps in its own definition error.
 */
export const resolveContentAccessScopeInput = (
  input: boolean | ContentAccessScopeInput | undefined,
): ResolvedContentAccessScope => {
  if (input === undefined || input === false) {
    return DISABLED_CONTENT_ACCESS_SCOPE;
  }
  if (input === true) return { defaults: {}, enabled: true };

  const parsed = zodScopeInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") ?? "";
    throw new Error(
      issue?.code === "unrecognized_keys"
        ? `access${path ? `.${path}` : ""}.${issue.keys[0]} is not an option. access accepts \`defaults\` with ${CONTENT_ACCESS_ACTIONS.join(", ")}, each { mode: "everyone" } or { mode: "members" }.`
        : `access${path ? `.${path}` : ""} is not valid: ${issue?.message ?? "unknown value"}. A code default is { mode: "everyone" } or { mode: "members" } - roles are chosen in the AdminCP.`,
    );
  }

  return {
    defaults: compactOverrides(parsed.data.defaults ?? {}),
    enabled: true,
  };
};

/**
 * Reads stored overrides defensively. A rule that no longer parses is not
 * dropped - that would widen it to whatever the parent allows - but becomes
 * {@link CONTENT_ACCESS_DENY_ALL}, so a corrupt row fails closed.
 */
export const readContentAccessOverrides = (
  value: unknown,
): ContentAccessOverrides => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const overrides: ContentAccessOverrides = {};
  for (const action of CONTENT_ACCESS_ACTIONS) {
    const entry = (value as Record<string, unknown>)[action];
    if (entry === undefined || entry === null) continue;

    const parsed = zodContentAccessAudienceRead.safeParse(entry);
    overrides[action] = parsed.success
      ? parsed.data.mode === "roles"
        ? { mode: "roles", roleIds: [...parsed.data.roleIds] }
        : { mode: parsed.data.mode }
      : CONTENT_ACCESS_DENY_ALL;
  }

  return overrides;
};

/** Whether `actor` belongs to `audience`. Root is decided by the caller. */
export const contentAccessAudienceMatches = (
  audience: ContentAccessAudience,
  actor: ContentAccessActor,
): boolean => {
  switch (audience.mode) {
    case "everyone":
      return true;
    case "members":
      return actor.kind === "member";
    case "roles":
      return (
        actor.kind === "member" &&
        actor.roleIds.some(roleId => audience.roleIds.includes(roleId))
      );
  }
};

export const isContentAccessAudienceOpen = (
  audience: ContentAccessAudience,
): boolean => audience.mode === "everyone";

/**
 * The rules one scope applies, after inheritance: for each action the nearest
 * scope in `chain` (the scope itself, then its ancestors) that sets it, then
 * the definition's default, then everyone.
 */
export const resolveContentAccessRules = ({
  chain,
  defaults,
}: {
  chain: readonly ContentAccessScopeLayer[];
  defaults: ContentAccessDefaultsInput;
}): {
  policy: ContentAccessPolicy;
  sources: Record<ContentAccessAction, ContentAccessRuleSource>;
} => {
  const policy = {} as ContentAccessPolicy;
  const sources = {} as Record<ContentAccessAction, ContentAccessRuleSource>;

  for (const action of CONTENT_ACCESS_ACTIONS) {
    const layer = chain.find(
      candidate => candidate.overrides[action] !== undefined,
    );
    const own = layer?.overrides[action];
    if (layer && own) {
      policy[action] = own;
      sources[action] = { kind: "scope", scopeId: layer.id };
      continue;
    }

    const fallback = defaults[action];
    policy[action] = fallback ?? EVERYONE;
    sources[action] = fallback ? { kind: "default" } : { kind: "fallback" };
  }

  return { policy, sources };
};

/** The actions `action` needs, itself last: `comment` is view, read, comment. */
export const contentAccessActionChain = (
  action: ContentAccessAction,
): ContentAccessAction[] => {
  const actions: ContentAccessAction[] = [];
  let next: ContentAccessAction | null = action;
  while (next) {
    actions.unshift(next);
    next = CONTENT_ACCESS_PREREQUISITES[next];
  }

  return actions;
};

/**
 * Everything an actor must satisfy to perform `action` in the scope at the
 * head of `chain`, as one flat list:
 *
 * - its own effective rule for the action and for every prerequisite;
 * - the `view` rule of every ancestor - a scope inside a hidden one is hidden;
 * - for `read` and what needs it, the `read` rule of every ancestor - a child
 *   can be stricter than its parent, never more open.
 *
 * Rules open to everyone are left out, so an empty list means "anyone may".
 */
export const contentAccessRequirements = ({
  action,
  chain,
  defaults,
  family,
}: {
  action: ContentAccessAction;
  chain: readonly ContentAccessScopeLayer[];
  defaults: ContentAccessDefaultsInput;
  family: string;
}): ContentAccessRequirement[] => {
  const [self] = chain;
  if (!self) return [];

  const needed = contentAccessActionChain(action);
  const requirements: ContentAccessRequirement[] = [];
  const add = (
    layerIndex: number,
    ruleAction: ContentAccessAction,
    via: ContentAccessRequirement["via"],
  ) => {
    const layer = chain[layerIndex];
    const { policy, sources } = resolveContentAccessRules({
      chain: chain.slice(layerIndex),
      defaults,
    });
    const audience = policy[ruleAction];
    if (isContentAccessAudienceOpen(audience)) return;

    requirements.push({
      action: ruleAction,
      audience,
      family,
      scopeId: layer.id,
      source: sources[ruleAction],
      via,
    });
  };

  // Ancestors first, from the root down, so the first unmet requirement names
  // the outermost scope that keeps the actor out.
  for (let index = chain.length - 1; index >= 1; index--) {
    add(index, "view", "ancestor");
    if (needed.includes("read")) add(index, "read", "ancestor");
  }
  for (const ruleAction of needed) add(0, ruleAction, "self");

  return requirements;
};

/** Whether `actor` meets every requirement. A root role meets all of them. */
export const decideContentAccess = (
  actor: ContentAccessActor,
  requirements: readonly ContentAccessRequirement[],
): ContentAccessDecision => {
  if (actor.kind === "member" && actor.root) {
    return { allowed: true, reason: "root" };
  }

  const unmet = requirements.find(
    requirement => !contentAccessAudienceMatches(requirement.audience, actor),
  );

  return unmet
    ? { allowed: false, requirement: unmet }
    : { allowed: true, reason: "granted" };
};

/** The four yes/no answers a frontend reads for one scope or record. */
export interface ContentAccessFlags {
  canComment: boolean;
  canDownloadAttachments: boolean;
  canRead: boolean;
  canView: boolean;
}

export const contentAccessFlagKey = {
  comment: "canComment",
  downloadAttachments: "canDownloadAttachments",
  read: "canRead",
  view: "canView",
} as const satisfies Record<ContentAccessAction, keyof ContentAccessFlags>;

export const CONTENT_ACCESS_OPEN_FLAGS: ContentAccessFlags = {
  canComment: true,
  canDownloadAttachments: true,
  canRead: true,
  canView: true,
};

export const zodContentAccessFlags = z.object({
  canComment: z.boolean(),
  canDownloadAttachments: z.boolean(),
  canRead: z.boolean(),
  canView: z.boolean(),
});

/** Every action's requirements for one chain, keyed by action. */
export const contentAccessRequirementsByAction = (args: {
  chain: readonly ContentAccessScopeLayer[];
  defaults: ContentAccessDefaultsInput;
  family: string;
}): Record<ContentAccessAction, ContentAccessRequirement[]> =>
  Object.fromEntries(
    CONTENT_ACCESS_ACTIONS.map(action => [
      action,
      contentAccessRequirements({ ...args, action }),
    ]),
  ) as Record<ContentAccessAction, ContentAccessRequirement[]>;

export const contentAccessFlagsOf = (
  actor: ContentAccessActor,
  requirements: Record<ContentAccessAction, readonly ContentAccessRequirement[]>,
): ContentAccessFlags =>
  Object.fromEntries(
    CONTENT_ACCESS_ACTIONS.map(action => [
      contentAccessFlagKey[action],
      decideContentAccess(actor, requirements[action]).allowed,
    ]),
  ) as unknown as ContentAccessFlags;

/** Two audiences that let in exactly the same members. */
export const sameContentAccessAudience = (
  a: ContentAccessAudience,
  b: ContentAccessAudience,
): boolean => {
  if (a.mode !== b.mode) return false;
  if (a.mode !== "roles" || b.mode !== "roles") return true;

  const left = [...new Set(a.roleIds)].sort((x, y) => x - y);
  const right = [...new Set(b.roleIds)].sort((x, y) => x - y);

  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
};
