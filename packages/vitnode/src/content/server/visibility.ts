import { sql } from "drizzle-orm";

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

export interface ContentVisibilityState {
  hiddenAt: Date | null;
  hiddenBy: null | number;
}

export interface ContentVisibilityChange {
  actorUserId: null | number;
  before: ContentVisibilityState;
  isPublic: boolean;
  wasPublic: boolean;
}

export interface ContentVisibilityOptions {
  actorUserId?: null | number;
  tx?: ContentDatabase;
}

export interface ContentVisibilityResult<TDefinition> {
  changed: boolean;
  hiddenAt: Date | null;
  hiddenBy: null | number;
  row: ContentSelect<TDefinition>;
  visibility: ContentVisibilityChange;
}

export interface ContentVisibilityMethods<TDefinition> {
  hide: (
    id: ContentIdOf<TDefinition>,
    options?: ContentVisibilityOptions,
  ) => Promise<ContentVisibilityResult<TDefinition> | null>;
  unhide: (
    id: ContentIdOf<TDefinition>,
    options?: ContentVisibilityOptions,
  ) => Promise<ContentVisibilityResult<TDefinition> | null>;
}

export interface ContentEditorialVisibilityOptions {
  actor: ContentActor;
  expectedVersion?: number;
  tx?: ContentDatabase;
}

export interface ContentEditorialVisibilityMethods<TDefinition> {
  hide: (
    id: ContentIdOf<TDefinition>,
    options: ContentEditorialVisibilityOptions,
  ) => Promise<ContentEditorialOutcome<TDefinition> | null>;
  unhide: (
    id: ContentIdOf<TDefinition>,
    options: ContentEditorialVisibilityOptions,
  ) => Promise<ContentEditorialOutcome<TDefinition> | null>;
}

export type ContentVisibilityMembers<TDefinition, TMethods> =
  TDefinition extends { visibility: { enabled: true } }
    ? TMethods
    : Partial<Record<keyof TMethods, never>>;

export const isInVisibilityState = (
  action: ContentVisibilityAction,
  row: Record<string, unknown>,
): boolean => {
  const hidden = row.hiddenAt !== null && row.hiddenAt !== undefined;

  return action === "hide" ? hidden : !hidden;
};

export const visibilityValues = (
  action: ContentVisibilityAction,
  actorUserId: null | number | undefined,
): Record<string, unknown> =>
  action === "hide"
    ? {
        hiddenAt: sql`now()`,
        hiddenBy: actorUserId ?? null,
        hiddenReason: null,
      }
    : { hiddenAt: null, hiddenBy: null, hiddenReason: null };

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

export const isContentBaseRowPublic = (row: Record<string, unknown>): boolean =>
  (row.deletedAt === null || row.deletedAt === undefined) &&
  isContentPubliclyVisible({
    hiddenAt: row.hiddenAt as Date | null | string | undefined,
    publishedAt: row.publishedAt as Date | null | string | undefined,
    status: typeof row.status === "string" ? row.status : undefined,
  });

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

export const visibilityMethods = <TDefinition extends AnyContentTypeDefinition>(
  definition: TDefinition,
  service: ContentService<TDefinition>,
): ContentVisibilityMethods<TDefinition> => {
  assertVisibility(definition);

  return service as ContentVisibilityMethods<TDefinition>;
};

export const editorialVisibilityMethods = <
  TDefinition extends AnyContentTypeDefinition,
>(
  definition: TDefinition,
  service: ContentEditorialService<TDefinition>,
): ContentEditorialVisibilityMethods<TDefinition> => {
  assertVisibility(definition);

  return service as ContentEditorialVisibilityMethods<TDefinition>;
};
