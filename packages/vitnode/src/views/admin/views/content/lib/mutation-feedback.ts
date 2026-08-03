/** Keys under `core.content.errors` that a mutation status maps onto. */
export type ContentErrorKey =
  "conflict" | "forbidden" | "not_found" | "validation";

/**
 * Turns a generated route's status into something a person can act on.
 *
 * The generated routes answer with a status and a generic sentence - never a
 * driver message - so the AdminCP can tell "you typed something invalid" from
 * "this row is still referenced" from "the server fell over" without ever
 * echoing what Postgres said. Anything unrecognised falls through to `null`,
 * which the caller renders as the global server-error message.
 */
export const contentErrorKey = (
  status: number | undefined,
): ContentErrorKey | null => {
  switch (status) {
    case 400:
      return "validation";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    default:
      return null;
  }
};
