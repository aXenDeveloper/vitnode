import type { ContentRowMutationResult } from "./list-mutations";

export const CONTENT_BULK_CONCURRENCY = 4;

export const CONTENT_BULK_ACTIONS = ["publish", "unpublish", "delete"] as const;

export type ContentBulkAction = (typeof CONTENT_BULK_ACTIONS)[number];

export interface ContentBulkResult {
  conflicted: number;
  failed: number;
  succeeded: number[];
}

export const contentBulkActions = ({
  canDelete,
  canPublish,
  publication,
}: {
  canDelete: boolean;
  canPublish: boolean;
  publication: boolean;
}): ContentBulkAction[] =>
  CONTENT_BULK_ACTIONS.filter(action =>
    action === "delete" ? canDelete : canPublish && publication,
  );

const SERVER_ERROR: ContentRowMutationResult = {
  error: "The API could not be reached.",
  status: 500,
};

export const runContentBulkAction = async (
  ids: readonly number[],
  runOne: (id: number) => Promise<ContentRowMutationResult>,
): Promise<ContentBulkResult> => {
  const outcomes = new Map<number, ContentRowMutationResult>();
  const queue = [...ids];

  const worker = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      outcomes.set(id, await runOne(id).catch(() => SERVER_ERROR));
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(CONTENT_BULK_CONCURRENCY, ids.length) },
      worker,
    ),
  );

  const result: ContentBulkResult = { conflicted: 0, failed: 0, succeeded: [] };

  for (const id of ids) {
    const outcome = outcomes.get(id) ?? SERVER_ERROR;

    if (outcome.error === undefined) result.succeeded.push(id);
    else if (outcome.status === 409) result.conflicted += 1;
    else result.failed += 1;
  }

  return result;
};
