import type { QueryClient } from '@tanstack/react-query'
import type {
  BulkDeleteFilesResult,
  DeleteFileResult,
  DeleteMyFile,
  DeleteMyFileArgs,
  DeleteMyFiles,
  DeleteMyFilesArgs,
} from '@vitnode/core/views/files/my-files-delete'
import type {
  MyFilesPageFetcher,
  MyFilesParams,
} from '@vitnode/core/views/files/my-files-query'

import { useQueryClient } from '@tanstack/react-query'
import { createIsomorphicFn } from '@tanstack/react-start'
import {
  deleteMyFileInBrowser,
  deleteMyFilesInBrowser,
  shouldRefreshAfterBulkDelete,
} from '@vitnode/core/views/files/my-files-delete'
import {
  fetchMyFilesPageInBrowser,
  MY_FILES_QUERY_ROOT,
  myFilesQueryOptions,
} from '@vitnode/core/views/files/my-files-query'
import React from 'react'

import { fetchMyFilesPageOnServer } from '#/server/my-files.server'

/**
 * The visitor's own files, as this app's one query definition and two deletes.
 *
 * Everything about *what* the list is - the request, the defaults, the cache
 * key, what counts as a refusal - comes from
 * `@vitnode/core/views/files/my-files-query`, which is also what the mounted
 * `MyFilesTableContent` is rendered from. This module supplies only the two
 * things core cannot know: how to reach the API from a server that is rendering
 * a request, and what "refresh the table" means in a router that has a query
 * cache instead of `revalidatePath`.
 */

/**
 * The transport boundary, and the reason one query definition works in a loader
 * and in a component.
 *
 * Both branches call the Hono API directly - the server one from inside the
 * request being rendered, the browser one over the network to the same origin.
 * There is deliberately no `createServerFn` in between. A server function is a
 * `POST` back to this app that then calls Hono, so every sort, page and search
 * of the table would cost two round trips for a read the API is already the
 * boundary for. The session read next door *is* a server function, and the
 * difference is real rather than stylistic: nothing here needs a `Set-Cookie`
 * copied onto this app's own response.
 *
 * The cookie still travels on both branches. On the server `fetcherServer`
 * forwards the one the page request arrived with; in the browser the call is
 * same-origin, so the browser attaches it without being asked. That is what
 * makes a `401` here mean "the session ended", never "we forgot to say who was
 * asking".
 *
 * `createIsomorphicFn` is what makes that safe rather than merely tidy: the
 * Start compiler keeps only the branch belonging to the bundle it is building
 * and drops the other's import with it, so `my-files.server.ts` - and the
 * `server-only` marker at the top of it - never reaches the browser.
 */
const fetchMyFilesPage: MyFilesPageFetcher = createIsomorphicFn()
  .server(fetchMyFilesPageOnServer)
  .client(fetchMyFilesPageInBrowser)

/**
 * The files table, as the one query definition every caller shares.
 *
 *     loader:     context.queryClient.ensureQueryData(myFilesQuery({ params }))
 *     component:  useQuery(myFilesQuery({ params }))
 *     after a delete: invalidate, and the component above refetches
 *
 * `params` must be the *normalised* ones - `normalizeMyFilesParams` from core,
 * over the route's validated search - because the cache key is built from them.
 * Passing raw URL values would make `?first=10` and no `first` two entries
 * holding identical rows, and the loader would fill one while the component read
 * the other.
 *
 * No `initialData`: the loader has already put the page in the entry this key
 * names and the SSR pass dehydrates it, so passing it again would be a second
 * copy of the same bytes that can disagree with the first.
 */
export const myFilesQuery = ({ params }: { params: MyFilesParams }) =>
  myFilesQueryOptions({ fetchPage: fetchMyFilesPage, params })

/**
 * Marks every cached page of the visitor's files stale.
 *
 * The whole family, by prefix - not the one page on screen. A delete changes
 * which rows exist, so every other page, sort and search of the same list is now
 * wrong too, and the visitor reaches those by pressing a button that reads from
 * the cache. It is emphatically *not* `queryClient.invalidateQueries()` with no
 * key: the session, the messages and every other list this app holds have not
 * changed, and refetching them because a file was deleted is the blunt version
 * of the `revalidatePath` this replaces.
 *
 * Invalidating rather than removing keeps the current rows on screen while the
 * fresh ones are fetched, instead of blanking the table under the dialog that is
 * still open.
 */
export const invalidateMyFiles = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: MY_FILES_QUERY_ROOT })

/**
 * Deletes one file, then refreshes the table if it actually went.
 *
 * Only on success. A `409` left the file exactly where it was and the dialog is
 * still open offering to force past the revisions holding it; refetching
 * underneath that would replace the rows the person is being asked about.
 */
export const deleteMyFile = async (
  queryClient: QueryClient,
  args: DeleteMyFileArgs,
): Promise<DeleteFileResult> => {
  const result = await deleteMyFileInBrowser(args)

  if (!result.error) await invalidateMyFiles(queryClient)

  return result
}

/**
 * Deletes a selection, then refreshes the table if anything went.
 *
 * `shouldRefreshAfterBulkDelete` is core's rule, and the same one the Next.js
 * server action applies before it calls `revalidatePath`: a run that deleted
 * nothing leaves the page as it was, and refetching would drop the selection
 * that is showing which rows were kept - which is the only thing telling the
 * person what to do next.
 */
export const deleteMyFiles = async (
  queryClient: QueryClient,
  args: DeleteMyFilesArgs,
): Promise<BulkDeleteFilesResult> => {
  const result = await deleteMyFilesInBrowser(args)

  if (shouldRefreshAfterBulkDelete(result)) await invalidateMyFiles(queryClient)

  return result
}

/**
 * The two callbacks `MyFilesTableContent` takes, bound to this router's cache.
 *
 * Memoised on the client, which is the only reason this is a hook rather than
 * two calls at the point of use: the callbacks are props on a table that
 * re-renders on every navigation, and new function identities would remount the
 * confirm dialogs mid-delete.
 */
export const useMyFilesDeleteCallbacks = (): {
  onDeleteFile: DeleteMyFile
  onDeleteFiles: DeleteMyFiles
} => {
  const queryClient = useQueryClient()

  return React.useMemo(
    () => ({
      onDeleteFile: async (args: DeleteMyFileArgs) =>
        await deleteMyFile(queryClient, args),
      onDeleteFiles: async (args: DeleteMyFilesArgs) =>
        await deleteMyFiles(queryClient, args),
    }),
    [queryClient],
  )
}
