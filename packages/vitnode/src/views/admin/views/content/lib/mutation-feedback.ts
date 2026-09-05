import type {
  ContentConflict,
  ContentDeliveryConflict,
  ContentUnprocessable,
} from "@/content/conflicts";

/** Keys under `core.content.errors` that a mutation status maps onto. */
export type ContentErrorKey =
  | "conflict"
  | "forbidden"
  | "not_found"
  | "not_restorable"
  | "slug_reserved"
  | "unique_conflict"
  | "validation"
  | "version_conflict";

export const contentErrorKey = (
  status: number | undefined,
  structured?: {
    conflict?: ContentConflict;
    delivery?: ContentDeliveryConflict;
    unprocessable?: ContentUnprocessable;
  },
): ContentErrorKey | null => {
  // Before the plain conflict, because the two share a status and mean different
  // things: a unique clash is "another record holds that address now, so you cannot
  // have it", and a reservation is "another record *used* to hold it and it still
  // redirects" - which is a different sentence and possibly a different decision.
  if (structured?.delivery) return "slug_reserved";

  if (structured?.conflict) {
    return structured.conflict.code === "CONTENT_VERSION_CONFLICT"
      ? "version_conflict"
      : "unique_conflict";
  }

  if (structured?.unprocessable) return "not_restorable";

  switch (status) {
    case 400:
      return "validation";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 422:
      return "not_restorable";
    default:
      return null;
  }
};
