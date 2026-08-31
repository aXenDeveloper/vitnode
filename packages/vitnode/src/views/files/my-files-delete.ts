import type { BulkDeleteFilesResult } from "@/lib/files/bulk-delete";
import type { DeleteFileResult } from "@/lib/files/in-use";

import { fetcherClient } from "@/lib/fetcher-client";
import {
  runBulkFileDelete,
  shouldRefreshAfterBulkDelete,
} from "@/lib/files/bulk-delete";
import { readFileInUse } from "@/lib/files/in-use";

import { userFilesModuleRef } from "./my-files-query";

/**
 * Deleting the visitor's own files, as a contract both frameworks satisfy.
 *
 * The API already accepts an authenticated `DELETE` from anywhere: it derives
 * the owner from the session cookie and refuses a file that is not theirs. So
 * the browser calls it directly - same origin, cookie attached by the browser
 * itself - and there is deliberately no server function in between. A server
 * function here would be a `POST` back to this app that then calls Hono, which
 * is two round trips and a second place to get the semantics wrong, in exchange
 * for nothing: this mutation needs no server-only secret, and it sets no cookie
 * that would have to be copied onto a response.
 *
 * The Next.js app keeps its server actions, which is not a contradiction. There
 * the delete has to end with `revalidatePath`, and that only exists on a server;
 * see `actions/delete-action.server.ts`. What both sides share is the *shape* -
 * the two callback types below, the 409 handling, and the bulk semantics - so
 * one table component can be handed either.
 */

/** Deleting one file. `force` releases retained revisions; see {@link FileInUse}. */
export interface DeleteMyFileArgs {
  force?: boolean;
  id: number;
}

/** Deleting a selection. The ids are exactly the rows that were ticked. */
export interface DeleteMyFilesArgs {
  force?: boolean;
  ids: number[];
}

/**
 * What the shared table is handed instead of a mutation.
 *
 * A plain async function returning a closed result, so a Next.js server action
 * and a browser fetch are the same prop. Nothing framework-shaped survives in
 * either direction.
 */
export type DeleteMyFile = (
  args: DeleteMyFileArgs,
) => Promise<DeleteFileResult>;

export type DeleteMyFiles = (
  args: DeleteMyFilesArgs,
) => Promise<BulkDeleteFilesResult>;

/**
 * One delete, as arguments to whichever fetcher is carrying it.
 *
 * `force` is omitted rather than sent as `"false"`, so the URL of an ordinary
 * delete says nothing about forcing at all - the route's schema accepts both,
 * but a request that never mentions it cannot be misread by a proxy or a log.
 */
export const deleteMyFileRequest = ({ force = false, id }: DeleteMyFileArgs) =>
  ({
    args: {
      params: { id: String(id) },
      query: force ? { force: "true" as const } : {},
    },
    method: "delete" as const,
    module: "files" as const,
    path: "/{id}" as const,
    prefixPath: "/users",
  }) as const;

/**
 * Deletes one of the visitor's files from the browser.
 *
 * Never rejects, and that is the contract rather than an oversight. Every way
 * this can fail is something the person has to be told in the dialog they are
 * standing in: a `409` is offered back as a confirmation, a `404` means somebody
 * already deleted it, and anything else is "try again". A rejected promise would
 * have to be caught by every caller to say the same thing, and `runBulkFileDelete`
 * would have to catch it a second time.
 *
 * The `500` case is why the `catch` exists at all: `rawApiFetch` throws on those
 * with the failing URL attached, and that throw is a server error like any other
 * - reported as `status: 500`, not as a crashed dialog.
 */
export const deleteMyFileInBrowser: DeleteMyFile = async ({
  force = false,
  id,
}) => {
  try {
    const response = await fetcherClient(userFilesModuleRef, {
      ...deleteMyFileRequest({ force, id }),
      options: { credentials: "include" },
    });

    if (response.status !== 200) {
      return {
        error: {
          inUse: await readFileInUse(response),
          status: response.status,
        },
      };
    }

    return { data: true };
  } catch {
    // `rawApiFetch` throws on a 500 with the server's own error text, which has
    // already been logged where a log belongs. The caller needs a status, not a
    // stack.
    return { error: { status: 500 } };
  }
};

/**
 * Deletes a selection from the browser, one request per file.
 *
 * `runBulkFileDelete` is core's own, unchanged and shared with the Next.js
 * server action: there is no bulk endpoint, so each id is the same single-file
 * delete the row action calls, the per-file semantics stay identical, and the
 * fan-out is capped. It never rejects and sorts the outcomes into the three
 * refusals a person acts on differently.
 */
export const deleteMyFilesInBrowser: DeleteMyFiles = async ({
  force = false,
  ids,
}) =>
  await runBulkFileDelete(
    ids,
    async id => await deleteMyFileInBrowser({ force, id }),
  );

/**
 * Re-exported rather than declared: the rule now lives beside
 * {@link runBulkFileDelete} in `lib/files/bulk-delete`, because the AdminCP's
 * file table applies the identical one and reaching into this module - which is
 * about the *visitor's own* files - to get it would be the wrong dependency.
 */
export { shouldRefreshAfterBulkDelete };

export type { BulkDeleteFilesResult, DeleteFileResult };
