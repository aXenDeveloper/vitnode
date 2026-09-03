import type { DeleteFileResult } from "./in-use";

export interface BulkDeleteFilesResult {
  /** Live content points at these, which `force` does not get past. */
  blockedByContent: number;
  deleted: number;
  /** Refused for some other reason - already gone, or a server error. */
  failed: number;

  heldByRevisions: number[];
}

const CONCURRENCY = 6;

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

export const shouldRefreshAfterBulkDelete = (
  result: BulkDeleteFilesResult,
): boolean => result.deleted > 0;
