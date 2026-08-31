import type { DeleteFileResult } from "./in-use";

/**
 * What a bulk file delete did, split by reason.
 *
 * Kept apart rather than reduced to "n of m failed" because the three refusals
 * need three different things from the person: content references have to be
 * removed elsewhere first, retained revisions can be forced past, and anything
 * else is a server error to retry.
 */
export interface BulkDeleteFilesResult {
  /** Live content points at these, which `force` does not get past. */
  blockedByContent: number;
  deleted: number;
  /** Refused for some other reason - already gone, or a server error. */
  failed: number;
  /**
   * Ids only retained revisions are holding.
   *
   * The ids and not a count: asking again with `force` has to act on exactly
   * these, never on the whole selection again.
   */
  heldByRevisions: number[];
}

/**
 * How many deletes are in flight at once.
 *
 * There is no bulk endpoint - each id is the same single-file delete the row
 * action calls, so the per-file semantics (ownership, the 409 and what it says)
 * stay identical. This caps the fan-out so a full page of 40 does not open 40
 * transactions at once.
 */
const CONCURRENCY = 6;

/**
 * Runs `deleteOne` over `ids` and sorts the outcomes into
 * {@link BulkDeleteFilesResult}.
 *
 * Never rejects: a bulk delete that stopped at the first refusal would leave
 * the person guessing which of the rest went through.
 */
export const runBulkFileDelete = async (
  ids: number[],
  deleteOne: (id: number) => Promise<DeleteFileResult>,
): Promise<BulkDeleteFilesResult> => {
  const result: BulkDeleteFilesResult = {
    blockedByContent: 0,
    deleted: 0,
    failed: 0,
    heldByRevisions: [],
  };
  const queue = [...ids];

  const worker = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      // A throw here is one id's problem, not the run's: the rest still get
      // their turn, and this one is reported as the server error it is.
      const outcome: DeleteFileResult = await deleteOne(id).catch(() => ({
        error: { status: 500 },
      }));

      if (!outcome.error) {
        result.deleted += 1;
        continue;
      }

      const { inUse } = outcome.error;

      // Only history holds this one, so it is offerable: collect the id rather
      // than counting it, so the force pass can name it.
      if (inUse && !inUse.content && inUse.revisions > 0) {
        result.heldByRevisions.push(id);
      } else if (inUse) {
        result.blockedByContent += 1;
      } else {
        result.failed += 1;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker),
  );

  return result;
};

/**
 * Whether a bulk run changed anything the table is showing.
 *
 * The rule a Next.js server action applies before it calls `revalidatePath`, and
 * the one a TanStack Start caller applies before it invalidates - one function,
 * so the two cannot drift. A run that was refused outright leaves the page
 * exactly as it was, and refetching would drop the selection that is showing
 * which rows were kept, which is the only thing telling the person what to do
 * next.
 *
 * Deliberately not "did anything happen": files blocked by content and files
 * held by revisions are both *unchanged*, and both are reported in the dialog
 * rather than by the table reloading underneath it.
 */
export const shouldRefreshAfterBulkDelete = (
  result: BulkDeleteFilesResult,
): boolean => result.deleted > 0;
