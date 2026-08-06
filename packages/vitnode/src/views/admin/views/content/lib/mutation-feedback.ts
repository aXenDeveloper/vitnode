import type {
  ContentConflict,
  ContentUnprocessable,
} from "@/content/conflicts";

/** Keys under `core.content.errors` that a mutation status maps onto. */
export type ContentErrorKey =
  | "conflict"
  | "forbidden"
  | "not_found"
  | "not_restorable"
  | "unique_conflict"
  | "validation"
  | "version_conflict";

/**
 * Turns a generated route's status into something a person can act on.
 *
 * The generated routes answer with a status and a generic sentence - never a
 * driver message - so the AdminCP can tell "you typed something invalid" from
 * "this row is still referenced" from "the server fell over" without ever
 * echoing what Postgres said. Anything unrecognised falls through to `null`,
 * which the caller renders as the global server-error message.
 *
 * An editorial route sends a JSON body with a `code` on the two statuses a
 * client has to branch on, and that wins when present: 409 alone cannot
 * distinguish "someone saved first" from "that value is taken", and the two
 * need different words *and* different buttons.
 */
export const contentErrorKey = (
  status: number | undefined,
  structured?: {
    conflict?: ContentConflict;
    unprocessable?: ContentUnprocessable;
  },
): ContentErrorKey | null => {
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
