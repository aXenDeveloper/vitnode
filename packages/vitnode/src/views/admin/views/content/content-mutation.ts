import type {
  ContentConflict,
  ContentDeliveryConflict,
  ContentScheduleRejection,
  ContentTranslationConflict,
  ContentUnprocessable,
} from "@/content/conflicts";

/**
 * What an editorial write answers with, whichever host asked.
 *
 * Pure types and nothing else - no `next/cache`, no `createServerFn`, no fetch.
 * The shape was declared inside `actions/mutation-api.server.ts` until Stage 13,
 * which made it unreachable from anything that is not Next.js: a `"use server"`
 * module drags `next/headers` and `server-only` into the graph of everything
 * that names it, type-only import or not, once a bundler stops erasing.
 *
 * Moving it changed none of the members and none of their meanings. Both
 * transports return exactly this, which is what lets one form - one submit
 * handler, one conflict branch, one toast - serve both AdminCPs.
 */

/** One language's row, as the tab strip, the panel and the form read it. */
export interface TranslationRow {
  itemId: number;
  languageId: number;
  locale: string;
  publishedAt?: null | string;
  status?: string;
  values: Record<string, unknown>;
  version: number;
}

/**
 * One language's half of a composite save, as the form assembled it.
 *
 * `expectedVersion` is absent when this language had no translation when the
 * form opened - a create, which has no version to be stale against.
 */
export interface ContentTranslationInput {
  expectedVersion?: number;
  locale: string;
  values: Record<string, unknown>;
}

/** Anything the generated routes return: an identifier plus the row's fields. */
export type ContentRow = Record<string, unknown> & { id: number };

/** A re-read of one record, for the conflict banner. */
export interface ContentRowResult {
  error?: string;
  row?: ContentRow;
}

export interface ContentMutationResult {
  /**
   * The structured reason an editorial write was refused, when the API sent
   * one. `CONTENT_VERSION_CONFLICT` is the interesting case: the dialog reloads
   * the newer record and offers to overwrite it, which it cannot do from a
   * sentence.
   */
  conflict?: ContentConflict;
  /**
   * `CONTENT_DELIVERY_SLUG_RESERVED`, naming the address and its locale.
   *
   * Its own field rather than a third arm of `conflict`, because the two share a
   * status and need different words: a unique clash is "another record holds that
   * address now", and this is "another record used to hold it and it still
   * redirects there".
   */
  delivery?: ContentDeliveryConflict;
  error?: string;
  /**
   * The identifier of a newly created record.
   *
   * Only set by a create, and only on success - a page-mode create navigates to
   * the record's own edit page, and guessing at the id would open the wrong one.
   */
  id?: number;
  /** Why a schedule was refused, when the API said. */
  rejection?: ContentScheduleRejection;
  /** Lets the UI tell a restricted delete (409) from a generic failure. */
  status?: number;
  /**
   * The same, for the language half of a composite save.
   *
   * Its own field rather than a second arm of `conflict`, because the two need
   * different words and point at different things: one says the record moved,
   * the other says one language of it did - and names which.
   */
  translationConflict?: ContentTranslationConflict;
  /**
   * Every translation as it stands **after** a composite save.
   *
   * The form keeps editing after a page-mode save, and its next save needs each
   * language's new version - reusing the ones it opened with would lose to the
   * write it just made.
   */
  translations?: TranslationRow[];
  /**
   * Nothing moved, so nothing was sent.
   *
   * Its own field rather than silence, because "saved" and "there was nothing
   * to save" are different things to the person who pressed the button - and
   * reporting the first for the second is how a form that is quietly failing
   * looks exactly like one that is working.
   */
  unchanged?: boolean;
  /** `CONTENT_REVISION_NOT_RESTORABLE`, naming the fields that no longer fit. */
  unprocessable?: ContentUnprocessable;
  /**
   * The version the record holds **after** this write.
   *
   * Read back so a form that stays open - page mode - can guard its next save on
   * the version it just created rather than on the one it opened with. Without
   * it, the second save of a session sends a version the record left behind and
   * gets a conflict banner naming an editor who does not exist.
   *
   * The translation half of the same problem is handled by `translations`; this
   * is the base row's.
   */
  version?: number;
}
