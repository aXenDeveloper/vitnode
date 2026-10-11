import type { ContentId } from "@/content/ids";

import { isContentPublished } from "@/content/publication";
import { isContentHidden } from "@/content/visibility";

import type { ContentRowMutationResult } from "./list-mutations";

export const CONTENT_BULK_CONCURRENCY = 4;

export const CONTENT_BULK_ACTIONS = [
  "publish",
  "unpublish",
  "hide",
  "unhide",
  "delete",
] as const;

export type ContentBulkAction = (typeof CONTENT_BULK_ACTIONS)[number];

export const CONTENT_BULK_GROUPS = [
  { actions: ["publish", "unpublish"], id: "status" },
  { actions: ["hide", "unhide"], id: "visibility" },
] as const satisfies readonly {
  actions: readonly ContentBulkAction[];
  id: string;
}[];

export type ContentBulkGroupId = (typeof CONTENT_BULK_GROUPS)[number]["id"];

export const contentBulkActionApplies = (
  action: ContentBulkAction,
  row: Readonly<Record<string, unknown>>,
): boolean => {
  switch (action) {
    case "delete":
      return true;
    case "hide":
      return !isContentHidden({ hiddenAt: row.hiddenAt });
    case "publish":
      return !isContentPublished(row.status);
    case "unhide":
      return isContentHidden({ hiddenAt: row.hiddenAt });
    case "unpublish":
      return isContentPublished(row.status);
  }
};

export interface ContentBulkResult<TId extends ContentId = ContentId> {
  conflicted: number;
  failed: number;
  succeeded: TId[];
}

export const contentBulkActions = ({
  canDelete,
  canHide,
  canPublish,
  publication,
  visibility,
}: {
  canDelete: boolean;
  canHide: boolean;
  canPublish: boolean;
  publication: boolean;
  visibility: boolean;
}): ContentBulkAction[] =>
  CONTENT_BULK_ACTIONS.filter(action => {
    switch (action) {
      case "delete":
        return canDelete;
      case "hide":
      case "unhide":
        return canHide && visibility;
      case "publish":
      case "unpublish":
        return canPublish && publication;
    }
  });

const SERVER_ERROR: ContentRowMutationResult = {
  error: "The API could not be reached.",
  status: 500,
};

export const runContentBulkAction = async <TId extends ContentId>(
  ids: readonly TId[],
  runOne: (id: TId) => Promise<ContentRowMutationResult>,
): Promise<ContentBulkResult<TId>> => {
  const outcomes = new Map<TId, ContentRowMutationResult>();
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

  const result: ContentBulkResult<TId> = {
    conflicted: 0,
    failed: 0,
    succeeded: [],
  };

  for (const id of ids) {
    const outcome = outcomes.get(id) ?? SERVER_ERROR;

    if (outcome.error === undefined) result.succeeded.push(id);
    else if (outcome.status === 409) result.conflicted += 1;
    else result.failed += 1;
  }

  return result;
};
