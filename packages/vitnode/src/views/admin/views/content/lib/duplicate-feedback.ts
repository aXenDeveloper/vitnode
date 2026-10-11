import type { ContentDuplicateRejection } from "@/content/conflicts";

import { CONTENT_DUPLICATE_CODES } from "@/content/const";

export type ContentDuplicateErrorMessage =
  | {
      key: "slug_conflict";
      values: { field: string; slug: string };
    }
  | {
      key: "unique_required";
      values: { count: number; fields: string };
    };

export const contentDuplicateErrorMessage = (
  rejection: ContentDuplicateRejection | undefined,
  {
    labelField,
    list = names => names.join(", "),
  }: {
    labelField: (name: string) => string;
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
