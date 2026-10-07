import type {
  ContentConflict,
  ContentDeliveryConflict,
  ContentDuplicateRejection,
  ContentScheduleRejection,
  ContentTranslationConflict,
  ContentUnprocessable,
} from "@/content/conflicts";
import type { ContentId } from "@/content/ids";

/** One language's row, as the tab strip, the panel and the form read it. */
export interface TranslationRow {
  itemId: ContentId;
  languageId: number;
  locale: string;
  publishedAt?: null | string;
  status?: string;
  updatedAt?: null | string;
  values: Record<string, unknown>;
  version: number;
}

export interface ContentTranslationInput {
  expectedVersion?: number;
  locale: string;
  values: Record<string, unknown>;
}

/** Anything the generated routes return: an identifier plus the row's fields. */
export type ContentRow = Record<string, unknown> & { id: ContentId };

/** A re-read of one record, for the conflict banner. */
export interface ContentRowResult {
  error?: string;
  row?: ContentRow;
}

export interface ContentMutationResult {
  conflict?: ContentConflict;

  delivery?: ContentDeliveryConflict;
  /** Why a duplicate was refused: no free slug (409) or a unique field (422). */
  duplicate?: ContentDuplicateRejection;
  error?: string;

  id?: ContentId;
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
