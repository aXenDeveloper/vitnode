import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { isNotNull, isNull, sql } from "drizzle-orm";

import type { ContentIdOf } from "../ids";
import type { ContentActor } from "../revisions";
import type { AnyContentTypeDefinition, ContentSelect } from "../types";
import type { ContentVisibilityAction } from "../visibility";
import type {
  ContentEditorialOutcome,
  ContentEditorialService,
} from "./editorial-service";
import type { ContentDatabase, ContentService } from "./service";

import { isContentPubliclyVisible } from "../cache";
import { ContentEngineError } from "../errors";

export type { ContentVisibilityAction };

/** The visibility columns as they stood *before* a mutation. */
export interface ContentVisibilityState {
  hiddenAt: Date | null;
  hiddenBy: null | number;
}

/**
 * What one hide or unhide did to public reachability, read off the row on both
 * sides of the write rather than assumed from the operation: hiding a draft
 * takes nothing off the site, and unhiding one puts nothing back.
 */
export interface ContentVisibilityChange {
  /** Who asked, or `null` for the system or an anonymous caller. */
  actorUserId: null | number;
  /** The visibility columns before the write. */
  before: ContentVisibilityState;
  /** Publicly reachable after the mutation. */
  isPublic: boolean;
  /** Publicly reachable before the mutation. */
  wasPublic: boolean;
}

export interface ContentVisibilityOptions {
  /** Stamped into `hiddenBy` by `hide`. `null` or absent for the system. */
  actorUserId?: null | number;
  /** Run inside an existing transaction. */
  tx?: ContentDatabase;
}

export interface ContentVisibilityResult<TDefinition> {
  /**
   * `false` when the record was already in that state: nothing was written, no
   * event is due and nothing needs invalidating.
   */
  changed: boolean;
  hiddenAt: Date | null;
  hiddenBy: null | number;
  row: ContentSelect<TDefinition>;
  visibility: ContentVisibilityChange;
}

/** `hide` / `unhide` on the plain repository. Present only with `visibility`. */
export interface ContentVisibilityMethods<TDefinition> {
  /**
   * Idempotent. Stamps `hiddenAt = now()` and `hiddenBy`, and never touches
   * `status` or `publishedAt`. `null` when the record does not exist.
   */
  hide: (
    id: ContentIdOf<TDefinition>,
    options?: ContentVisibilityOptions,
  ) => Promise<ContentVisibilityResult<TDefinition> | null>;
  /** Idempotent. Clears both columns; the publication state is left alone. */
  unhide: (
    id: ContentIdOf<TDefinition>,
    options?: ContentVisibilityOptions,
  ) => Promise<ContentVisibilityResult<TDefinition> | null>;
}

export interface ContentEditorialVisibilityOptions {
  actor: ContentActor;
  /**
   * Enforced when supplied, exactly like `publish`: hiding overwrites no field
   * value, so a colleague's typo fix is not a reason to refuse it.
   */
  expectedVersion?: number;
  /** Join an existing transaction instead of opening one. */
  tx?: ContentDatabase;
}

/** `hide` / `unhide` on the editorial service. Present only with `visibility`. */
export interface ContentEditorialVisibilityMethods<TDefinition> {
  /**
   * Bumps the version and writes a `hide` revision. A no-op - the record is
   * already hidden - writes nothing and returns `changed: false`.
   */
  hide: (
    id: ContentIdOf<TDefinition>,
    options: ContentEditorialVisibilityOptions,
  ) => Promise<ContentEditorialOutcome<TDefinition> | null>;
  unhide: (
    id: ContentIdOf<TDefinition>,
    options: ContentEditorialVisibilityOptions,
  ) => Promise<ContentEditorialOutcome<TDefinition> | null>;
}

/** The type-level gate: `hide`/`unhide` exist exactly when visibility does. */
export type ContentVisibilityMembers<TDefinition, TMethods> =
  TDefinition extends { visibility: { enabled: true } }
    ? TMethods
    : Partial<Record<keyof TMethods, never>>;

/** Whether the row already is where `action` would put it. */
export const isInVisibilityState = (
  action: ContentVisibilityAction,
  row: Record<string, unknown>,
): boolean => {
  const hidden = row.hiddenAt !== null && row.hiddenAt !== undefined;

  return action === "hide" ? hidden : !hidden;
};

/** The guard that makes one visibility `UPDATE` a real state change. */
export const visibilityGuard = (
  action: ContentVisibilityAction,
  columns: Record<string, PgColumn>,
): SQL =>
  action === "hide" ? isNull(columns.hiddenAt) : isNotNull(columns.hiddenAt);

/**
 * The `SET` of one visibility mutation. `now()` rather than a JavaScript date, so
 * `hiddenAt` is on the same clock as `publishedAt` and the public predicate.
 */
export const visibilityValues = (
  action: ContentVisibilityAction,
  actorUserId: null | number | undefined,
): Record<string, unknown> =>
  action === "hide"
    ? { hiddenAt: sql`now()`, hiddenBy: actorUserId ?? null }
    : { hiddenAt: null, hiddenBy: null };

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return null;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const visibilityStateOf = (
  row: Record<string, unknown>,
): ContentVisibilityState => ({
  hiddenAt: toDate(row.hiddenAt),
  hiddenBy: typeof row.hiddenBy === "number" ? row.hiddenBy : null,
});

/** Whether one base row is publicly reachable, `hiddenAt` included. */
export const isContentBaseRowPublic = (
  row: null | Record<string, unknown>,
): boolean =>
  row !== null &&
  isContentPubliclyVisible({
    hiddenAt: row.hiddenAt as Date | null | string | undefined,
    publishedAt: row.publishedAt as Date | null | string | undefined,
    status: typeof row.status === "string" ? row.status : undefined,
  });

/** The reachability change between two rows the caller already holds. */
export const visibilityChange = ({
  actorUserId,
  after,
  before,
}: {
  actorUserId: null | number | undefined;
  after: Record<string, unknown>;
  before: Record<string, unknown>;
}): ContentVisibilityChange => ({
  actorUserId: actorUserId ?? null,
  before: visibilityStateOf(before),
  isPublic: isContentBaseRowPublic(after),
  wasPublic: isContentBaseRowPublic(before),
});

const assertVisibility = (definition: AnyContentTypeDefinition): void => {
  if (!definition.visibility.enabled) {
    throw new ContentEngineError(
      "hide/unhide need `visibility: { enabled: true }` on the content type.",
      { contentTypeId: definition.id },
    );
  }
};

/**
 * The plain repository's `hide`/`unhide`, for code written against an open
 * definition - a route builder - where the conditional type has not resolved.
 * The runtime flag is the same one the type reads.
 */
export const visibilityMethods = <TDefinition extends AnyContentTypeDefinition>(
  definition: TDefinition,
  service: ContentService<TDefinition>,
): ContentVisibilityMethods<TDefinition> => {
  assertVisibility(definition);

  return service as unknown as ContentVisibilityMethods<TDefinition>;
};

/** The editorial twin of {@link visibilityMethods}. */
export const editorialVisibilityMethods = <
  TDefinition extends AnyContentTypeDefinition,
>(
  definition: TDefinition,
  service: ContentEditorialService<TDefinition>,
): ContentEditorialVisibilityMethods<TDefinition> => {
  assertVisibility(definition);

  return service as unknown as ContentEditorialVisibilityMethods<TDefinition>;
};
