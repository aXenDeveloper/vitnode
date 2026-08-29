import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import React from "react";

import type { BulkDeleteFilesResult } from "@/lib/files/bulk-delete";
import type { DeleteFileResult } from "@/lib/files/in-use";
import type {
  DeleteAdminFile,
  DeleteAdminFileArgs,
  DeleteAdminFiles,
  DeleteAdminFilesArgs,
} from "@/views/admin/views/core/system/files/files-delete";
import type {
  AdminFilesPageFetcher,
  AdminFilesParams,
} from "@/views/admin/views/core/system/files/files-query";

import { shouldRefreshAfterBulkDelete } from "@/lib/files/bulk-delete";
import {
  deleteAdminFileInBrowser,
  deleteAdminFilesInBrowser,
} from "@/views/admin/views/core/system/files/files-delete";
import {
  adminFilesQueryOptions,
  adminFilesQueryRoot,
  fetchAdminFilesPageInBrowser,
} from "@/views/admin/views/core/system/files/files-query";

import { fetchAdminFilesPageOnServer } from "./server";

/**
 * The AdminCP file list for a TanStack Start host: one query definition and two
 * deletes.
 *
 * Everything about *what* the list is comes from
 * `@/views/admin/views/core/system/files/files-query`, which is also what the
 * mounted `FilesTableContent` renders from. This module supplies the two things
 * that module cannot know: how to reach the API from a server that is rendering
 * a request, and what "refresh the table" means in a router that has a query
 * cache instead of `revalidatePath`.
 */

/**
 * The transport boundary. Both branches call Hono directly - the server one from
 * inside the request being rendered, the browser one over the network to the
 * same origin - and the admin cookie travels on both. See
 * `tanstack/admin/cron/query.ts` for the full argument, including why the
 * chained call is written out per feature rather than hidden behind a helper.
 */
const fetchAdminFilesPage: AdminFilesPageFetcher = createIsomorphicFn()
  .server(fetchAdminFilesPageOnServer)
  .client(fetchAdminFilesPageInBrowser);

/**
 * The admin file list, as the one query definition every caller shares.
 *
 * `params` must be the *normalised* ones, because the cache key is built from
 * them.
 */
export const adminFilesQuery = ({ params }: { params: AdminFilesParams }) =>
  adminFilesQueryOptions({ fetchPage: fetchAdminFilesPage, params });

/**
 * Marks every cached page of the admin file list stale.
 *
 * The whole family, by prefix - not the one page on screen. A delete changes
 * which rows exist, so every other page, sort and search of the same list is now
 * wrong too, and the administrator reaches those by pressing a button that reads
 * from the cache.
 *
 * Invalidating rather than removing keeps the current rows on screen while the
 * fresh ones are fetched, instead of blanking the table under the dialog that is
 * still open.
 */
export const invalidateAdminFiles = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: adminFilesQueryRoot });

/**
 * Deletes one file, then refreshes the table if it actually went.
 *
 * Only on success. A `409` left the file exactly where it was and the dialog is
 * still open offering to force past the revisions holding it; refetching
 * underneath that would replace the rows the administrator is being asked about.
 */
export const deleteAdminFile = async (
  queryClient: QueryClient,
  args: DeleteAdminFileArgs,
): Promise<DeleteFileResult> => {
  const result = await deleteAdminFileInBrowser(args);

  if (!result.error) await invalidateAdminFiles(queryClient);

  return result;
};

/**
 * Deletes a selection, then refreshes the table if anything went.
 *
 * `shouldRefreshAfterBulkDelete` is the shared rule, and the same one the
 * Next.js server action applies before it calls `revalidatePath`: a run that
 * deleted nothing leaves the page as it was, and refetching would drop the
 * selection that is showing which rows were kept.
 */
export const deleteAdminFiles = async (
  queryClient: QueryClient,
  args: DeleteAdminFilesArgs,
): Promise<BulkDeleteFilesResult> => {
  const result = await deleteAdminFilesInBrowser(args);

  if (shouldRefreshAfterBulkDelete(result)) {
    await invalidateAdminFiles(queryClient);
  }

  return result;
};

/**
 * The two callbacks `FilesTableContent` takes, bound to the mounted router's
 * cache.
 *
 * Memoised, which is the only reason this is a hook rather than two calls at the
 * point of use: they are props on a table that re-renders on every navigation,
 * and new function identities would remount the confirm dialogs mid-delete.
 */
export const useAdminFilesDeleteCallbacks = (): {
  onDeleteFile: DeleteAdminFile;
  onDeleteFiles: DeleteAdminFiles;
} => {
  const queryClient = useQueryClient();

  return React.useMemo(
    () => ({
      onDeleteFile: async (args: DeleteAdminFileArgs) =>
        await deleteAdminFile(queryClient, args),
      onDeleteFiles: async (args: DeleteAdminFilesArgs) =>
        await deleteAdminFiles(queryClient, args),
    }),
    [queryClient],
  );
};
