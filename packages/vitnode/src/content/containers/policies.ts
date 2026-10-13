import { z } from "zod";

import type { AnyContentTypeDefinition } from "../types";

import { CONTENT_ID_PATTERN } from "../const";
import { ContentEngineError } from "../errors";
import {
  CONTENT_CONTAINER_POLICY_AUTHOR_EDIT,
  CONTENT_CONTAINER_POLICY_CREATE,
  CONTENT_CONTAINER_POLICY_KEYS,
  CONTENT_CONTAINER_POLICY_MAX_MINUTES,
  CONTENT_CONTAINER_POLICY_MODES,
} from "./const";

export type ContentContainerPolicyCreate =
  (typeof CONTENT_CONTAINER_POLICY_CREATE)[number];

export type ContentContainerPolicyMode =
  (typeof CONTENT_CONTAINER_POLICY_MODES)[number];

export type ContentContainerPolicyAuthorEdit =
  (typeof CONTENT_CONTAINER_POLICY_AUTHOR_EDIT)[number];

export type ContentContainerPolicyKey =
  (typeof CONTENT_CONTAINER_POLICY_KEYS)[number];

export interface ContentContainerPolicy {
  authorEdit: ContentContainerPolicyAuthorEdit;
  authorEditMinutes: number;
  create: ContentContainerPolicyCreate;
  edits: ContentContainerPolicyMode;
  publish: ContentContainerPolicyMode;
}

export type ContentContainerPolicyInput = Partial<ContentContainerPolicy>;

/** Per content type id, what one container overrides. A missing key inherits. */
export type ContentContainerPolicyOverrides = Record<
  string,
  ContentContainerPolicyInput
>;

export interface ContentContainerPoliciesInput {
  contentTypes?: Record<string, ContentContainerPolicyInput>;
  defaults?: ContentContainerPolicyInput;
}

export interface ResolvedContentContainerPolicies {
  contentTypes: Record<string, ContentContainerPolicyInput>;
  defaults: ContentContainerPolicyInput;
  enabled: boolean;
}

export type ContentContainerPolicySource =
  | { containerId: number; kind: "container" }
  | { kind: "contentType" }
  | { kind: "default" }
  | { kind: "fallback" };

export interface EffectiveContentContainerPolicy {
  policy: ContentContainerPolicy;
  sources: Record<ContentContainerPolicyKey, ContentContainerPolicySource>;
}

export const DISABLED_CONTENT_CONTAINER_POLICIES: ResolvedContentContainerPolicies =
  { contentTypes: {}, defaults: {}, enabled: false };

export const zodContentContainerPolicy = z.strictObject({
  authorEdit: z.enum(CONTENT_CONTAINER_POLICY_AUTHOR_EDIT).optional(),
  authorEditMinutes: z
    .number()
    .int()
    .min(1)
    .max(CONTENT_CONTAINER_POLICY_MAX_MINUTES)
    .optional(),
  create: z.enum(CONTENT_CONTAINER_POLICY_CREATE).optional(),
  edits: z.enum(CONTENT_CONTAINER_POLICY_MODES).optional(),
  publish: z.enum(CONTENT_CONTAINER_POLICY_MODES).optional(),
});

export const zodContentContainerPolicyOverrides = z.record(
  z.string().regex(CONTENT_ID_PATTERN),
  zodContentContainerPolicy,
);

export const zodEffectiveContentContainerPolicy = z.object({
  authorEdit: z.enum(CONTENT_CONTAINER_POLICY_AUTHOR_EDIT),
  authorEditMinutes: z.number(),
  create: z.enum(CONTENT_CONTAINER_POLICY_CREATE),
  edits: z.enum(CONTENT_CONTAINER_POLICY_MODES),
  publish: z.enum(CONTENT_CONTAINER_POLICY_MODES),
});

const compact = (
  value: ContentContainerPolicyInput,
): ContentContainerPolicyInput =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );

const parsePolicy = (
  id: string,
  label: string,
  value: unknown,
): ContentContainerPolicyInput => {
  const parsed = zodContentContainerPolicy.safeParse(value);
  if (parsed.success) return compact(parsed.data);

  const issue = parsed.error.issues[0];
  const key = issue?.path[0];
  throw new ContentEngineError(
    issue?.code === "unrecognized_keys"
      ? `${label}.${issue.keys[0]} is not a policy. A policy accepts: ${CONTENT_CONTAINER_POLICY_KEYS.join(", ")}.`
      : `${label}${typeof key === "string" ? `.${key}` : ""} is not valid: ${issue?.message ?? "unknown value"}.`,
    { contentTypeId: id },
  );
};

export const resolveContentContainerPolicies = (
  id: string,
  policies: ContentContainerPoliciesInput | false | undefined,
): ResolvedContentContainerPolicies => {
  if (policies === undefined || policies === false) {
    return DISABLED_CONTENT_CONTAINER_POLICIES;
  }

  if (typeof policies !== "object" || Array.isArray(policies)) {
    throw new ContentEngineError(
      "policies is an object with `defaults` and `contentTypes`, or `false`.",
      { contentTypeId: id },
    );
  }

  const unknown = Object.keys(policies).find(
    key => key !== "defaults" && key !== "contentTypes",
  );
  if (unknown !== undefined) {
    throw new ContentEngineError(
      `policies.${unknown} is not an option. policies accepts: defaults, contentTypes.`,
      { contentTypeId: id },
    );
  }

  const contentTypes: Record<string, ContentContainerPolicyInput> = {};
  for (const [contentTypeId, value] of Object.entries(
    policies.contentTypes ?? {},
  )) {
    if (!CONTENT_ID_PATTERN.test(contentTypeId)) {
      throw new ContentEngineError(
        `policies.contentTypes has the key "${contentTypeId}", which is not a content type id like "plugin.entity".`,
        { contentTypeId: id },
      );
    }
    contentTypes[contentTypeId] = parsePolicy(
      id,
      `policies.contentTypes["${contentTypeId}"]`,
      value,
    );
  }

  return {
    contentTypes,
    defaults: parsePolicy(id, "policies.defaults", policies.defaults ?? {}),
    enabled: true,
  };
};

/**
 * What a content type does when nothing above it decides: its own
 * `publicWrite.create.status`, owners editing for as long as they like.
 */
export const contentContainerPolicyFallback = (
  definition: Pick<AnyContentTypeDefinition, "publicWrite">,
): ContentContainerPolicy => ({
  authorEdit: "always",
  authorEditMinutes: 60,
  create: "members",
  edits: "immediate",
  publish:
    definition.publicWrite.create.status === "published"
      ? "immediate"
      : "approve",
});

/**
 * The effective policy of one content type in one container.
 *
 * `chain` is the container followed by its ancestors, nearest first. Every key
 * is decided on its own: the first container in the chain that sets it, then
 * the definition's per-type default, its general default and the fallback.
 */
export const resolveContentContainerPolicy = ({
  chain,
  contentTypeId,
  fallback,
  policies,
}: {
  chain: readonly { id: number; policies: ContentContainerPolicyOverrides }[];
  contentTypeId: string;
  fallback: ContentContainerPolicy;
  policies: ResolvedContentContainerPolicies;
}): EffectiveContentContainerPolicy => {
  const policy = { ...fallback };
  const sources = Object.fromEntries(
    CONTENT_CONTAINER_POLICY_KEYS.map(key => [key, { kind: "fallback" }]),
  ) as EffectiveContentContainerPolicy["sources"];

  const layers: [ContentContainerPolicyInput, ContentContainerPolicySource][] =
    [
      ...chain.map(
        container =>
          [
            container.policies[contentTypeId] ?? {},
            { containerId: container.id, kind: "container" },
          ] as [ContentContainerPolicyInput, ContentContainerPolicySource],
      ),
      [policies.contentTypes[contentTypeId] ?? {}, { kind: "contentType" }],
      [policies.defaults, { kind: "default" }],
    ];

  for (const key of CONTENT_CONTAINER_POLICY_KEYS) {
    for (const [layer, source] of layers) {
      if (!Object.hasOwn(layer, key) || layer[key] === undefined) continue;
      (policy as Record<string, unknown>)[key] = layer[key];
      sources[key] = source;
      break;
    }
  }

  return { policy, sources };
};

/** Whether an owner may still edit a record created at `createdAt`. */
export const contentAuthorMayEdit = (
  policy: Pick<ContentContainerPolicy, "authorEdit" | "authorEditMinutes">,
  createdAt: Date | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (policy.authorEdit === "always") return true;
  if (policy.authorEdit === "never") return false;
  if (!(createdAt instanceof Date)) return false;

  return (
    now.getTime() - createdAt.getTime() < policy.authorEditMinutes * 60_000
  );
};

/** Reads a stored `policies` column defensively: unknown keys and values are dropped. */
export const readContentContainerPolicyOverrides = (
  value: unknown,
): ContentContainerPolicyOverrides => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const overrides: ContentContainerPolicyOverrides = {};
  for (const [contentTypeId, entry] of Object.entries(value)) {
    const parsed = zodContentContainerPolicy.safeParse(entry);
    if (parsed.success) overrides[contentTypeId] = compact(parsed.data);
  }

  return overrides;
};
