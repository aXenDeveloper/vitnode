import type { MultiLangValue } from "@/lib/helpers/multi-lang";

/** Moderator permissions of core's `warnings` module. */
export const WARNING_PERMISSIONS = {
  view: "can_view",
  warn: "can_warn",
  overridePoints: "can_override_points",
  overrideExpiration: "can_override_expiration",
  viewNotes: "can_view_notes",
  revoke: "can_revoke",
  viewSanctions: "can_view_sanctions",
  manageSanctions: "can_manage_sanctions",
} as const;

/** The core permission module holding {@link WARNING_PERMISSIONS}. */
export const WARNING_PERMISSION_MODULE = "warnings";

export const WARNING_LIMITS = {
  maxPoints: 100,
  maxThresholdPoints: 1000,
  maxReasons: 50,
  maxThresholds: 20,
  /** Five years, the longest expiration or suspension a form accepts. */
  maxDurationHours: 24 * 365 * 5,
  messageMinLength: 3,
  messageMaxLength: 2000,
  noteMaxLength: 2000,
  explanationMinLength: 3,
  reasonTitleMaxLength: 100,
  reasonDescriptionMaxLength: 255,
  reasonMessageMaxLength: 2000,
  pageSize: 25,
} as const;

export const WARNING_STATUSES = ["active", "expired", "revoked"] as const;

export type WarningStatus = (typeof WARNING_STATUSES)[number];

export const WARNING_THRESHOLD_ACTIONS = [
  "suspend_temporary",
  "suspend_indefinite",
] as const;

export type WarningThresholdAction = (typeof WARNING_THRESHOLD_ACTIONS)[number];

/** Kinds of account sanction. Only suspensions exist so far. */
export const SANCTION_TYPES = ["suspension"] as const;

export type SanctionType = (typeof SANCTION_TYPES)[number];

export const SANCTION_SOURCES = ["threshold", "manual"] as const;

export type SanctionSource = (typeof SANCTION_SOURCES)[number];

/** What a warning remembers about its reason, so renaming the reason never rewrites history. */
export interface WarningReasonSnapshot {
  title: MultiLangValue;
}

/** What a warning remembers about the content it was issued for. */
export interface WarningContentSnapshot {
  title: null | string;
  url: null | string;
}

/** What a threshold sanction remembers about the rule that created it. */
export interface SanctionThresholdSnapshot {
  action: WarningThresholdAction;
  durationHours: null | number;
  points: number;
}

/**
 * The status of a warning at `now`. Derived from timestamps on every read, so
 * it is right whether or not a scheduled job has run. Pure.
 */
export const warningStatusAt = (
  warning: { expiresAt: Date | null; revokedAt: Date | null },
  now: Date,
): WarningStatus => {
  if (warning.revokedAt) return "revoked";
  if (warning.expiresAt && warning.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }

  return "active";
};

/**
 * The points a user holds at `now`: warnings that are not revoked and have
 * not expired. Pure.
 */
export const activeWarningPoints = (
  warnings: readonly {
    expiresAt: Date | null;
    points: number;
    revokedAt: Date | null;
  }[],
  now: Date,
): number =>
  warnings.reduce(
    (total, warning) =>
      warningStatusAt(warning, now) === "active"
        ? total + warning.points
        : total,
    0,
  );

export interface WarningThresholdRule {
  action: WarningThresholdAction;
  durationHours: null | number;
  enabled: boolean;
  id: number;
  points: number;
}

export interface ThresholdEvaluation<T extends WarningThresholdRule> {
  /** The one rule to apply: the highest crossed one, or `null`. */
  applied: null | T;
  /** Every enabled rule the change crossed, lowest first. */
  crossed: T[];
}

/**
 * Which threshold rules a change of active points from `before` to `after`
 * crosses - a rule at `points` is crossed when `before < points <= after` -
 * and which one applies: only the highest, so one warning never creates two
 * suspensions. A rule already at or below `before` was crossed earlier and is
 * not applied again. Pure.
 */
export const evaluateWarningThresholds = <T extends WarningThresholdRule>({
  after,
  before,
  rules,
}: {
  after: number;
  before: number;
  rules: readonly T[];
}): ThresholdEvaluation<T> => {
  const crossed = rules
    .filter(
      rule => rule.enabled && before < rule.points && rule.points <= after,
    )
    .sort((a, b) => a.points - b.points || a.id - b.id);

  return { applied: crossed.at(-1) ?? null, crossed };
};

/** When a suspension created by `rule` at `now` ends; `null` for indefinite. Pure. */
export const thresholdSuspensionEnd = (
  rule: Pick<WarningThresholdRule, "action" | "durationHours">,
  now: Date,
): Date | null =>
  rule.action === "suspend_temporary" && rule.durationHours
    ? new Date(now.getTime() + rule.durationHours * 60 * 60 * 1000)
    : null;

/** Whether a sanction applies at `now`: not revoked, started and not ended. Pure. */
export const isSanctionActiveAt = (
  sanction: { endsAt: Date | null; revokedAt: Date | null; startsAt: Date },
  now: Date,
): boolean =>
  !sanction.revokedAt &&
  sanction.startsAt.getTime() <= now.getTime() &&
  (sanction.endsAt === null || sanction.endsAt.getTime() > now.getTime());
