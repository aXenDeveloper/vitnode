import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import React from "react";

import type {
  BulkDeleteFilesResult,
  DeleteFileResult,
  DeleteMyFile,
  DeleteMyFileArgs,
  DeleteMyFiles,
  DeleteMyFilesArgs,
} from "@/views/files/my-files-delete";
import type {
  MyFilesPageFetcher,
  MyFilesParams,
} from "@/views/files/my-files-query";

import {
  deleteMyFileInBrowser,
  deleteMyFilesInBrowser,
  shouldRefreshAfterBulkDelete,
} from "@/views/files/my-files-delete";
import {
  fetchMyFilesPageInBrowser,
  myFilesQueryOptions,
  myFilesQueryRoot,
} from "@/views/files/my-files-query";

import { fetchMyFilesPageOnServer } from "./server";

/**
 * The visitor's own files, as one query definition and two deletes, for a
 * TanStack Start host.
 *
 * Everything about *what* the list is - the request, the defaults, the cache
 * key, what counts as a refusal - comes from `@/views/files/my-files-query`,
 * which is also what the mounted `MyFilesTableContent` is rendered from. This
 * module supplies only the two things that module cannot know: how to reach the
 * API from a server that is rendering a request, and what "refresh the table"
 * means in a router that has a query cache instead of `revalidatePath`.
 */

/**
 * The transport boundary, and the reason one query definition works in a loader
 * and in a component.
 *
 * Both branches call the Hono API directly - the server one from inside the
 * request being rendered, the browser one over the network to the same origin.
 * There is deliberately no `createServerFn` in between. A server function is a
 * `POST` back to the app that then calls Hono, so every sort, page and search of
 * the table would cost two round trips for a read the API is already the
 * boundary for. A session read *is* a server function, and the difference is
 * real rather than stylistic: nothing here needs a `Set-Cookie` copied onto the
 * app's own response.
 *
 * The cookie still travels on both branches. On the server `fetcherServer`
 * forwards the one the page request arrived with; in the browser the call is
 * same-origin, so the browser attaches it without being asked. That is what
 * makes a `401` here mean "the session ended", never "we forgot to say who was
 * asking".
 *
 * `createIsomorphicFn` is what makes that safe rather than merely tidy: the
 * Start compiler keeps only the branch belonging to the bundle it is building
 * and drops the other's import with it, so `./server` - and the `server-only`
 * marker at the top of it - never reaches the browser.
 *
 * Written out here rather than behind a shared helper, and that is the compiler
 * rather than taste: the transform matches the *chained call*, so a
 * `.server(fn)` passed as an ordinary argument somewhere else would leave the
 * server import in the client graph. Each feature spells its own out, and the
 * duplication is three lines rather than two fetch implementations.
 */
const fetchMyFilesPage: MyFilesPageFetcher = createIsomorphicFn()
  .server(fetchMyFilesPageOnServer)
  .client(fetchMyFilesPageInBrowser);

/**
 * The files table, as the one query definition every caller shares.
 *
 *     loader:     ensureQueryData(myFilesQuery({ params, userId }))
 *     component:  useQuery(myFilesQuery({ params, userId }))
 *     after a delete: invalidate that visitor's family, and it refetches
 *
 * `params` must be the *normalised* ones - `myFilesRouteParams` over the
 * route's validated search - because the cache key is built from them. Passing
 * raw URL values would make `?first=10` and no `first` two entries holding
 * identical rows, and the loader would fill one while the component read the
 * other.
 *
 * `userId` is the *cache* owner and nothing more. It comes from the
 * authenticated boundary's own state - the canonical session read, not a second
 * source - and it never reaches the API: `GET /users/files` takes no owner and
 * derives one from the session cookie. See `myFilesQueryRoot` for why the entry
 * has to be partitioned at all.
 *
 * No `initialData`: the loader has already put the page in the entry this key
 * names and the SSR pass dehydrates it, so passing it again would be a second
 * copy of the same bytes that can disagree with the first.
 */
export const myFilesQuery = ({
  params,
  userId,
}: {
  params: MyFilesParams;
  userId: number;
}) => myFilesQueryOptions({ fetchPage: fetchMyFilesPage, params, userId });

/**
 * Marks every cached page of *one* visitor's files stale.
 *
 * The whole family, by prefix - not the one page on screen. A delete changes
 * which rows exist, so every other page, sort and search of the same list is now
 * wrong too, and the visitor reaches those by pressing a button that reads from
 * the cache. It is emphatically *not* `queryClient.invalidateQueries()` with no
 * key: the session, the messages and every other list the app holds have not
 * changed, and refetching them because a file was deleted is the blunt version
 * of the `revalidatePath` this replaces.
 *
 * Scoped to `userId`, which narrows it twice over. `myFilesQueryRoot(userId)` is
 * a prefix of every one of that visitor's pages and of nobody else's, so a
 * long-lived browser client that still holds a previous visitor's partition
 * keeps it - untouched and unreachable, because every authenticated route builds
 * its key from the current session. Invalidating another partition would refetch
 * a list nobody is looking at, on behalf of a visitor who has gone.
 *
 * Invalidating rather than removing keeps the current rows on screen while the
 * fresh ones are fetched, instead of blanking the table under the dialog that is
 * still open.
 */
export const invalidateMyFiles = async (
  queryClient: QueryClient,
  userId: number,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: myFilesQueryRoot(userId) });

/**
 * Deletes one file, then refreshes the table if it actually went.
 *
 * Only on success. A `409` left the file exactly where it was and the dialog is
 * still open offering to force past the revisions holding it; refetching
 * underneath that would replace the rows the person is being asked about.
 */
export const deleteMyFile = async (
  queryClient: QueryClient,
  userId: number,
  args: DeleteMyFileArgs,
): Promise<DeleteFileResult> => {
  const result = await deleteMyFileInBrowser(args);

  if (!result.error) await invalidateMyFiles(queryClient, userId);

  return result;
};

/**
 * Deletes a selection, then refreshes the table if anything went.
 *
 * `shouldRefreshAfterBulkDelete` is the shared rule, and the same one the
 * Next.js server action applies before it calls `revalidatePath`: a run that
 * deleted nothing leaves the page as it was, and refetching would drop the
 * selection that is showing which rows were kept - which is the only thing
 * telling the person what to do next.
 */
export const deleteMyFiles = async (
  queryClient: QueryClient,
  userId: number,
  args: DeleteMyFilesArgs,
): Promise<BulkDeleteFilesResult> => {
  const result = await deleteMyFilesInBrowser(args);

  if (shouldRefreshAfterBulkDelete(result)) {
    await invalidateMyFiles(queryClient, userId);
  }

  return result;
};

/**
 * The two callbacks `MyFilesTableContent` takes, bound to the mounted router's
 * cache and to the visitor whose partition of it they may touch.
 *
 * `userId` is taken as an argument rather than read here, and that is the whole
 * of "do not derive it three different ways": the route reads it from the
 * authenticated boundary once in its loader, returns it, and hands the same
 * value to the query options and to this hook. A second read - even of the same
 * canonical entry - could resolve differently mid-navigation and invalidate a
 * partition the table is not showing.
 *
 * It scopes an invalidation and nothing else. Neither delete request carries an
 * owner; `DELETE /users/files/{id}` authorizes from the session cookie, as it
 * did before this parameter existed.
 *
 * Memoised on the client, which is the only reason this is a hook rather than
 * two calls at the point of use: the callbacks are props on a table that
 * re-renders on every navigation, and new function identities would remount the
 * confirm dialogs mid-delete.
 */
export const useMyFilesDeleteCallbacks = (
  userId: number,
): {
  onDeleteFile: DeleteMyFile;
  onDeleteFiles: DeleteMyFiles;
} => {
  const queryClient = useQueryClient();

  return React.useMemo(
    () => ({
      onDeleteFile: async (args: DeleteMyFileArgs) =>
        await deleteMyFile(queryClient, userId, args),
      onDeleteFiles: async (args: DeleteMyFilesArgs) =>
        await deleteMyFiles(queryClient, userId, args),
    }),
    [queryClient, userId],
  );
};
