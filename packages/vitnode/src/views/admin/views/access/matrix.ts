import type {
  ContentAccessAction,
  ContentAccessAudience,
} from "@/content/access/policy";
import type { ContentAccessAdminResponse } from "@/content/access/schemas";

/** One row of the access matrix: guests, signed-in members or a role id. */
export type ContentAccessMatrixRow = "guests" | "members" | number;

type Requirement =
  ContentAccessAdminResponse["report"]["actions"][ContentAccessAction]["requirements"][number];

/** Whether `audience` lets `row` in, before any other rule is counted. */
export const audienceIncludes = (
  audience: ContentAccessAudience,
  row: ContentAccessMatrixRow,
): boolean => {
  if (audience.mode === "everyone") return true;
  if (row === "guests") return false;
  if (audience.mode === "members") return true;
  if (row === "members") return false;

  return audience.roleIds.includes(row);
};

/** Whether `row` is let in only because a wider group above it is. */
export const audienceIncludesViaWiderGroup = (
  audience: ContentAccessAudience,
  row: ContentAccessMatrixRow,
): boolean => {
  if (row === "guests") return false;
  if (audience.mode === "everyone") return true;

  return row !== "members" && audience.mode === "members";
};

/**
 * The audience after ticking (`next`) or unticking one row. Unticking
 * signed-in members keeps every role, unticking one role out of a wider
 * audience keeps all the others.
 */
export const toggleAudienceRow = (
  audience: ContentAccessAudience,
  row: ContentAccessMatrixRow,
  next: boolean,
  roleIds: readonly number[],
): ContentAccessAudience => {
  if (row === "guests") return { mode: next ? "everyone" : "members" };
  if (row === "members") {
    if (next)
      return { mode: audience.mode === "everyone" ? "everyone" : "members" };

    return { mode: "roles", roleIds: [...roleIds] };
  }
  if (audience.mode === "roles") {
    return {
      mode: "roles",
      roleIds: next
        ? [...new Set([...audience.roleIds, row])]
        : audience.roleIds.filter(id => id !== row),
    };
  }

  return { mode: "roles", roleIds: roleIds.filter(id => id !== row) };
};

/**
 * The first rule that still keeps a ticked `row` out of `action`: a parent's
 * rule or an action this one needs first. The cell's own rule never counts -
 * ticking the row already meets it.
 */
export const blockingRequirementOf = ({
  action,
  requirements,
  row,
}: {
  action: ContentAccessAction;
  requirements: readonly Requirement[];
  row: ContentAccessMatrixRow;
}): null | Requirement =>
  requirements.find(
    requirement =>
      !(requirement.via === "self" && requirement.action === action) &&
      !audienceIncludes(requirement.audience, row),
  ) ?? null;
