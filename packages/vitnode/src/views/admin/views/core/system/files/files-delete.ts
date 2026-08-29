import type { BulkDeleteFilesResult } from "@/lib/files/bulk-delete";
import type { DeleteFileResult } from "@/lib/files/in-use";

import { fetcherClient } from "@/lib/fetcher-client";
import { runBulkFileDelete } from "@/lib/files/bulk-delete";
import { readFileInUse } from "@/lib/files/in-use";

import { filesAdminModuleRef } from "./files-query";

/**
 * Deleting an uploaded file from the AdminCP, as a contract both frameworks
 * satisfy.
 *
 * `DELETE /admin/files/{id}` declares
 * `adminStaffPermission: { module: "files", permission: "can_delete" }` and
 * re-checks it on every request, so the browser may call it directly - same
 * origin, admin cookie attached by the browser itself - and there is no server
 * function in between. One would be a `POST` back to the app that then calls
 * Hono: two round trips and a second place to get the `409` handling wrong.
 *
 * The Next.js app keeps its server actions, which is not a contradiction: there
 * the delete has to end with `revalidatePath`. What both sides share is the
 * shape below, the `409` handling and the bulk accounting, so one table can be
 * handed either.
 */

/** Deleting one file. `force` releases retained revisions; see `FileInUse`. */
export interface DeleteAdminFileArgs {
  force?: boolean;
  id: number;
}

/** Deleting a selection. The ids are exactly the rows that were ticked. */
export interface DeleteAdminFilesArgs {
  force?: boolean;
  ids: number[];
}

/**
 * What the shared table is handed instead of a mutation.
 *
 * Plain async functions returning closed results, so a Next.js server action and
 * a browser fetch are the same prop.
 */
export type DeleteAdminFile = (
  args: DeleteAdminFileArgs,
) => Promise<DeleteFileResult>;

export type DeleteAdminFiles = (
  args: DeleteAdminFilesArgs,
) => Promise<BulkDeleteFilesResult>;

/**
 * One delete, as arguments to whichever fetcher is carrying it.
 *
 * `force` is omitted rather than sent as `"false"`, so the URL of an ordinary
 * delete says nothing about forcing at all - the route's schema accepts both,
 * but a request that never mentions it cannot be misread by a proxy or a log.
 */
export const deleteAdminFileRequest = ({
  force = false,
  id,
}: DeleteAdminFileArgs) =>
  ({
    args: {
      params: { id: String(id) },
      query: force ? { force: "true" as const } : {},
    },
    method: "delete" as const,
    module: "files" as const,
    path: "/{id}" as const,
    prefixPath: "/admin",
  }) as const;

/**
 * Deletes one uploaded file from the browser.
 *
 * Never rejects, and that is the contract rather than an oversight. Every way
 * this can fail is something the administrator has to be told in the dialog they
 * are standing in: a `409` is offered back as a confirmation, a `404` means
 * somebody already deleted it, and anything else is "try again". The `catch`
 * exists because `rawApiFetch` throws on a `500` with the failing URL attached -
 * a server error like any other, reported as `status: 500` rather than as a
 * crashed dialog.
 */
export const deleteAdminFileInBrowser: DeleteAdminFile = async ({
  force = false,
  id,
}) => {
  try {
    const response = await fetcherClient(filesAdminModuleRef, {
      ...deleteAdminFileRequest({ force, id }),
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
    return { error: { status: 500 } };
  }
};

/**
 * Deletes a selection from the browser, one request per file.
 *
 * `runBulkFileDelete` is core's own, unchanged and shared with the Next.js
 * server action: there is no bulk endpoint, so each id is the same single-file
 * delete the row action calls, the per-file semantics stay identical, and the
 * fan-out is capped.
 */
export const deleteAdminFilesInBrowser: DeleteAdminFiles = async ({
  force = false,
  ids,
}) =>
  await runBulkFileDelete(
    ids,
    async id => await deleteAdminFileInBrowser({ force, id }),
  );

export type { BulkDeleteFilesResult, DeleteFileResult };
