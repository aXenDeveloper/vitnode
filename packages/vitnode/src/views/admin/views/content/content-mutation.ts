import type {
  ContentConflict,
  ContentDeliveryConflict,
  ContentScheduleRejection,
  ContentTranslationConflict,
  ContentUnprocessable,
} from "@/content/conflicts";

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
  conflict?: ContentConflict;

  delivery?: ContentDeliveryConflict;
  error?: string;

  id?: number;
  /** Why a schedule was refused, when the API said. */
  rejection?: ContentScheduleRejection;
  /** Lets the UI tell a restricted delete (409) from a generic failure. */
  status?: number;

  translationConflict?: ContentTranslationConflict;

  translations?: TranslationRow[];

  unchanged?: boolean;
  /** `CONTENT_REVISION_NOT_RESTORABLE`, naming the fields that no longer fit. */
  unprocessable?: ContentUnprocessable;

  version?: number;
}
