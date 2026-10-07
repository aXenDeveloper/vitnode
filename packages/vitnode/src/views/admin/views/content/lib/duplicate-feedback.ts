import type { ContentDuplicateRejection } from "@/content/conflicts";

import { CONTENT_DUPLICATE_CODES } from "@/content/const";

/** A refused duplicate, as the sentence under `core.content.duplicate.errors`. */
export type ContentDuplicateErrorMessage =
  | {
      key: "slug_conflict";
      values: { field: string; slug: string };
    }
  | {
      key: "unique_required";
      values: { count: number; fields: string };
    };

/**
 * Names the field a refused copy is about, in the administrator's words.
 *
 * `null` for everything else - a version conflict, a delivery reservation, a
 * `404` - which the shared `contentErrorKey` already has a sentence for.
 */
export const contentDuplicateErrorMessage = (
  rejection: ContentDuplicateRejection | undefined,
  {
    labelField,
    list = names => names.join(", "),
  }: {
    labelField: (name: string) => string;
    /** Joins the field labels the way the reader's language joins a list. */
    list?: (names: string[]) => string;
  },
): ContentDuplicateErrorMessage | null => {
  if (!rejection) return null;

  if (rejection.code === CONTENT_DUPLICATE_CODES.slugConflict) {
    return {
      key: "slug_conflict",
      values: { field: labelField(rejection.field), slug: rejection.slug },
    };
  }

  return {
    key: "unique_required",
    values: {
      count: rejection.fields.length,
      fields: list(rejection.fields.map(labelField)),
    },
  };
};
