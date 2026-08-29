/**
 * One AdminCP write, and every way it can end.
 *
 * The Next.js AdminCP performs its writes through `"use server"` actions that
 * finish with `revalidatePath`. A TanStack Start route has neither, and needs
 * neither: the admin session is a `path=/` cookie, so a click handler can call
 * Hono directly, and "the list on screen is now wrong" is a React Query
 * invalidation - which the *caller* performs, because only the caller knows
 * which administrator's cache partition to invalidate.
 *
 * So a mutation here does exactly one thing: send the request, and describe the
 * answer. No cache, no navigation, no toast, no redirect.
 *
 * ## Why they return instead of throwing
 *
 * Every AdminCP write has a specific failure the screen has to show in a
 * specific place: `409` on a name code is a field error beside that field, `403`
 * on a staff edit is "you cannot edit your own permissions", `404` is a stale
 * link. A thrown error has lost which one it was by the time it reaches a
 * `catch`, so the status comes back as data and the screen decides.
 *
 * ## Why every call is wrapped
 *
 * `rawApiFetch` *throws* on a `500` rather than returning it, and a fetch to an
 * API that is not listening rejects. Both have to become a toast rather than an
 * unhandled rejection that takes the AdminCP down with them, so both arrive as
 * `{ error: { status: 500 } }`.
 */

/**
 * What a mutation answers with: the data, or the refusal that stopped it.
 *
 * `message` is the API's own body, present when it sent one. Several AdminCP
 * routes answer `409` with a sentence rather than a code - "Email already
 * exists" - and which field that belongs beside is a decision the screen makes,
 * so the sentence has to survive as far as the screen.
 */
export interface AdminMutationError {
  message?: string;
  status: number;
}

export type AdminMutationResult<TData> =
  { data: TData } | { error: AdminMutationError };

/** A thrown `500`, an unreachable API, and a rejected fetch all land here. */
export const ADMIN_MUTATION_UNREACHABLE = 500;

export const isAdminMutationError = <TData>(
  result: AdminMutationResult<TData>,
): result is { error: AdminMutationError } => "error" in result;

/**
 * The API's body, if it can be read.
 *
 * Never throws and never rejects: this runs while something has *already* gone
 * wrong, and a body that cannot be read must not replace the status - which is
 * the part a caller can always act on - with a second failure.
 */
const readErrorMessage = async (
  response: Response,
): Promise<string | undefined> => {
  try {
    const text = await response.text();

    return text.trim() === "" ? undefined : text;
  } catch {
    return undefined;
  }
};

/**
 * Runs one admin write and turns every outcome into a result.
 *
 * `expected` is named rather than inferred from "not an error status" because
 * the AdminCP's routes are not uniform - a create answers `201` and everything
 * else `200` - and treating an unexpected `202` as success would be a guess.
 */
export const runAdminApiMutation = async <TData>({
  expected,
  parse,
  request,
}: {
  expected: number;
  /**
   * Awaitable, but not required to be. Several of these routes answer with no
   * body at all - a `200` and nothing else - and forcing those to be `async`
   * only to satisfy a signature is noise the linter is right about.
   */
  parse: (response: Response) => Promise<TData> | TData;
  request: () => Promise<Response>;
}): Promise<AdminMutationResult<TData>> => {
  try {
    const response = await request();
    if (response.status !== expected) {
      return {
        error: {
          message: await readErrorMessage(response),
          status: response.status,
        },
      };
    }

    return { data: await parse(response) };
  } catch (error) {
    // The one place a caller cannot see: the status it gets back says only
    // "unreachable", and this is what says *why*.
    // eslint-disable-next-line no-console
    console.error("[admin] a mutation could not be sent", error);

    return { error: { status: ADMIN_MUTATION_UNREACHABLE } };
  }
};
