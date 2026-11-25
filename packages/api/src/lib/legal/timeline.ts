import type { LegalDocumentType, LegalVersionStatus } from "./contract";

/** What the timeline rules need from an announced version. Browser-safe. */
export interface LegalTimelineEntry {
  announcedAt: string;
  documentType: LegalDocumentType;
  effectiveAt: string;
  id: number;
  requiresAcceptance: boolean;
  version: number;
}

/** One document type's versions resolved against a point in time. */
export interface LegalTimeline<
  T extends LegalTimelineEntry = LegalTimelineEntry,
> {
  /** The latest version whose effective time has passed. */
  current: null | T;
  /** Every announced version of the type, newest first. */
  history: T[];
  /**
   * The minimum Terms version a member must have accepted: the latest
   * effective version that requires acceptance. Informational releases never
   * move it. Always `null` for the Privacy Policy.
   */
  required: null | T;
  /** The announced version that is not effective yet, if any. */
  upcoming: null | T;
}

/**
 * Resolves current, upcoming and required versions of one document type at
 * `now`. Pure and browser-safe.
 */
export const resolveLegalTimeline = <T extends LegalTimelineEntry>(
  entries: readonly T[],
  documentType: LegalDocumentType,
  now: Date = new Date(),
): LegalTimeline<T> => {
  const history = entries
    .filter(entry => entry.documentType === documentType)
    .sort((a, b) => b.version - a.version);
  const nowMs = now.getTime();
  const effective = history.filter(
    entry => Date.parse(entry.effectiveAt) <= nowMs,
  );
  const pending = history.filter(
    entry => Date.parse(entry.effectiveAt) > nowMs,
  );

  return {
    current: effective[0] ?? null,
    history,
    required:
      documentType === "terms"
        ? (effective.find(entry => entry.requiresAcceptance) ?? null)
        : null,
    upcoming: pending.at(-1) ?? null,
  };
};

/** Where a version stands at `now`. Browser-safe. */
export const legalVersionStatus = (
  entry: LegalTimelineEntry,
  timeline: Pick<LegalTimeline, "current">,
  now: Date = new Date(),
): LegalVersionStatus => {
  if (Date.parse(entry.effectiveAt) > now.getTime()) return "upcoming";

  return timeline.current?.id === entry.id ? "current" : "past";
};

/**
 * The Terms version a member must accept now, or `null` when they are clear.
 * They owe acceptance while the last version they accepted is older than the
 * required one; they then accept the *current* text, which includes any later
 * informational edits. An informational release alone never creates a new
 * obligation. Pure and browser-safe.
 */
export const pendingTermsOf = <T extends LegalTimelineEntry>(
  timeline: LegalTimeline<T>,
  lastAcceptedVersion: null | number,
): null | T => {
  if (!timeline.required || !timeline.current) return null;
  if ((lastAcceptedVersion ?? 0) >= timeline.required.version) return null;

  return timeline.current;
};

/** The version announced just before `version`, if any. Browser-safe. */
export const previousLegalVersion = <T extends LegalTimelineEntry>(
  timeline: Pick<LegalTimeline<T>, "history">,
  version: number,
): null | T => timeline.history.find(entry => entry.version < version) ?? null;
