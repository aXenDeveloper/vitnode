import { z } from "zod";

import type { ContentAccessAction } from "./policy";

import { CONTENT_ACCESS_ACTIONS, CONTENT_ACCESS_ERROR_CODES } from "./const";
import { zodContentAccessAudienceRead } from "./policy";

const zodRuleSource = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("default") }),
  z.object({ kind: z.literal("fallback") }),
  z.object({ kind: z.literal("scope"), scopeId: z.string() }),
]);

export const zodContentAccessRequirement = z.object({
  action: z.enum(CONTENT_ACCESS_ACTIONS),
  audience: zodContentAccessAudienceRead,
  family: z.string(),
  scopeId: z.string(),
  source: zodRuleSource,
  via: z.enum(["ancestor", "self"]),
});

const zodActionReport = z.object({
  effective: zodContentAccessAudienceRead,
  inherited: zodContentAccessAudienceRead,
  inheritedSource: zodRuleSource,
  prerequisite: z.enum(CONTENT_ACCESS_ACTIONS).nullable(),
  requirements: z.array(zodContentAccessRequirement),
  source: zodRuleSource,
});

/** What the AdminCP access editor shows for one scope. */
export const zodContentAccessScopeReport = z.object({
  actions: z.object(
    Object.fromEntries(
      CONTENT_ACCESS_ACTIONS.map(action => [action, zodActionReport]),
    ) as Record<ContentAccessAction, typeof zodActionReport>,
  ),
  /** Scopes below this one, whose access changes with it. */
  descendants: z.number().int(),
  family: z.string(),
  overrides: z.record(z.string(), zodContentAccessAudienceRead),
  scopeId: z.string(),
  /** Actions nobody but a root role can perform here. */
  warnings: z.array(
    z.object({
      action: z.enum(CONTENT_ACCESS_ACTIONS),
      kind: z.enum(["nobody"]),
      scopeId: z.string(),
    }),
  ),
});

export type ContentAccessScopeReport = z.infer<
  typeof zodContentAccessScopeReport
>;

export const zodContentAccessError = z.object({
  code: z.enum(CONTENT_ACCESS_ERROR_CODES),
  message: z.string(),
});

export const zodContentAccessAttachmentSupport = z.object({
  /** Whether the storage adapter can keep files private. */
  privateStorage: z.boolean(),
});

export const zodContentAccessAdminRole = z.object({
  color: z.string().nullable(),
  id: z.number(),
  name: z.array(z.object({ languageCode: z.string(), name: z.string() })),
});

export const zodContentAccessAdminResponse = z.object({
  attachments: zodContentAccessAttachmentSupport,
  report: zodContentAccessScopeReport,
  /** Every role the report names that still exists, for labels. */
  roles: z.array(zodContentAccessAdminRole),
});

export type ContentAccessAdminRole = z.infer<typeof zodContentAccessAdminRole>;

export type ContentAccessAdminResponse = z.infer<
  typeof zodContentAccessAdminResponse
>;

/**
 * What a record filed under several scopes would require, as the editor of
 * an `access.from` content type asks: every scope's requirements together.
 */
export const zodContentAccessEffectiveResponse = z.object({
  actions: z.object(
    Object.fromEntries(
      CONTENT_ACCESS_ACTIONS.map(action => [
        action,
        z.object({ requirements: z.array(zodContentAccessRequirement) }),
      ]),
    ) as Record<
      ContentAccessAction,
      z.ZodObject<{
        requirements: z.ZodArray<typeof zodContentAccessRequirement>;
      }>
    >,
  ),
  /** Scope ids that do not exist; a record filed there is readable by nobody. */
  missing: z.array(z.string()),
  roles: z.array(zodContentAccessAdminRole),
});

export type ContentAccessEffectiveResponse = z.infer<
  typeof zodContentAccessEffectiveResponse
>;

/** Where a family's files are stored: what is protected and what is not. */
export const zodContentAccessFileStatus = z.object({
  /** Whether the storage adapter can keep files private at all. */
  privateStorage: z.boolean(),
  private: z.number().int(),
  /** Still reachable by anybody holding the URL. */
  public: z.number().int(),
});

export type ContentAccessFileStatusResponse = z.infer<
  typeof zodContentAccessFileStatus
>;

export const zodContentAccessProtectResult = z.object({
  moved: z.number().int(),
  /** Public files left for the next batch. */
  remaining: z.number().int(),
  /** Public files other content uses too, which stay public. */
  shared: z.number().int(),
});

export type ContentAccessProtectResult = z.infer<
  typeof zodContentAccessProtectResult
>;
