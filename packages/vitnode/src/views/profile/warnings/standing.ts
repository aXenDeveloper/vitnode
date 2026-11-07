import type { RichTextDocument } from "@/content/rich-text/document";
import type { WarningMessage, WarningStatus } from "@/lib/moderation/warnings";
import type { ReportPerson } from "@/views/moderation/modcp/report-tone";
import type {
  AccountStatus,
  ModcpMemberStanding,
} from "@/views/moderation/warnings/warnings-api";

export interface StandingWarning {
  content: null | { title: null | string; url: null | string };
  expiresAt: Date | null;
  id: number;
  issuedAt: Date;
  issuedBy: null | ReportPerson | undefined;
  message: WarningMessage;
  overrideNote: null | string;
  points: number;
  reason: AccountStatus["warnings"][number]["reason"];
  reportId: null | number;
  revokedAt: Date | null;
  revokedBy: null | ReportPerson | undefined;
  revokeReason: null | string;
  staffNote: null | RichTextDocument;
  status: WarningStatus;
}

export interface StandingSuspension {
  active: boolean;
  endsAt: Date | null;
  id: number;
  lifted: boolean;
  liftedAt: Date | null;
  liftedBy: null | ReportPerson | undefined;
  liftReason: null | string;
  source: "manual" | "threshold" | null;
  startsAt: Date;
  thresholdPoints: null | number;
  warningId: null | number;
}

export interface ProfileStanding {
  activePoints: number;
  can: { lift: boolean; revoke: boolean; warn: boolean };
  hiddenWarnings: number;
  own: boolean;
  seeAllHref: string;
  suspensions: StandingSuspension[];
  warnings: StandingWarning[];
}

export type StandingEntry =
  | { at: Date; kind: "suspension"; suspension: StandingSuspension }
  | { at: Date; kind: "warning"; warning: StandingWarning };

const toDate = (value: Date | string) => new Date(value);

const toOptionalDate = (value: Date | null | string) =>
  value === null ? null : new Date(value);

export const standingFromModcp = (
  data: ModcpMemberStanding,
): ProfileStanding => ({
  activePoints: data.activePoints,
  can: {
    lift: data.permissions.manageSanctions,
    revoke: data.permissions.revoke,
    warn: data.permissions.warn,
  },
  hiddenWarnings: data.hiddenWarnings,
  own: false,
  seeAllHref: `/modcp/members/${data.user.id}`,
  suspensions: (data.sanctions ?? []).map(sanction => ({
    active: sanction.active,
    endsAt: toOptionalDate(sanction.endsAt),
    id: sanction.id,
    lifted: sanction.revokedAt !== null,
    liftedAt: toOptionalDate(sanction.revokedAt),
    liftedBy: sanction.revokedBy,
    liftReason: sanction.revokeReason,
    source: sanction.source,
    startsAt: toDate(sanction.startsAt),
    thresholdPoints: sanction.threshold?.points ?? null,
    warningId: sanction.warningId,
  })),
  warnings: data.warnings.map(warning => ({
    content: warning.content
      ? { title: warning.content.title, url: warning.content.url }
      : null,
    expiresAt: toOptionalDate(warning.expiresAt),
    id: warning.id,
    issuedAt: toDate(warning.issuedAt),
    issuedBy: warning.issuedBy,
    message: warning.message,
    overrideNote: warning.overrideNote,
    points: warning.points,
    reason: warning.reason,
    reportId: warning.reportId,
    revokedAt: toOptionalDate(warning.revokedAt),
    revokedBy: warning.revokedBy,
    revokeReason: warning.revokeReason,
    staffNote: warning.staffNote,
    status: warning.status,
  })),
});

export const standingFromAccountStatus = (
  data: AccountStatus,
): ProfileStanding => ({
  activePoints: data.activePoints,
  can: { lift: false, revoke: false, warn: false },
  hiddenWarnings: 0,
  own: true,
  seeAllHref: "/settings/standing",
  suspensions: data.sanctions.map(sanction => ({
    active: sanction.active,
    endsAt: toOptionalDate(sanction.endsAt),
    id: sanction.id,
    lifted: sanction.revoked,
    liftedAt: toOptionalDate(sanction.liftedAt),
    liftedBy: undefined,
    liftReason: null,
    source: null,
    startsAt: toDate(sanction.startsAt),
    thresholdPoints: null,
    warningId: sanction.warningId,
  })),
  warnings: data.warnings.map(warning => ({
    content: warning.content,
    expiresAt: toOptionalDate(warning.expiresAt),
    id: warning.id,
    issuedAt: toDate(warning.issuedAt),
    issuedBy: undefined,
    message: warning.message,
    overrideNote: null,
    points: warning.points,
    reason: warning.reason,
    reportId: null,
    revokedAt: null,
    revokedBy: undefined,
    revokeReason: null,
    staffNote: null,
    status: warning.status,
  })),
});

export const standingEntries = (standing: ProfileStanding): StandingEntry[] =>
  [
    ...standing.warnings.map(warning => ({
      at: warning.issuedAt,
      kind: "warning" as const,
      warning,
    })),
    ...standing.suspensions.map(suspension => ({
      at: suspension.startsAt,
      kind: "suspension" as const,
      suspension,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

export const activeSuspensionOf = (standing: ProfileStanding) =>
  standing.suspensions.find(suspension => suspension.active);

export const suspensionHours = (suspension: StandingSuspension) =>
  suspension.endsAt
    ? Math.round(
        (suspension.endsAt.getTime() - suspension.startsAt.getTime()) /
          3_600_000,
      )
    : null;

export const elapsedShare = (from: Date, to: Date, now = Date.now()) => {
  const span = to.getTime() - from.getTime();
  if (span <= 0) return 1;

  return Math.min(Math.max((now - from.getTime()) / span, 0), 1);
};

export type StandingTarget =
  | null
  | { id: number; kind: "suspension" }
  | { id: number; kind: "warning" };

export type StandingConfirm =
  | null
  | { kind: "lift"; suspension: StandingSuspension }
  | { kind: "revoke"; warning: StandingWarning };
