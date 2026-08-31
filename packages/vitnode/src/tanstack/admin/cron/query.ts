import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import React from "react";

import type {
  CronPageFetcher,
  CronParams,
} from "@/views/admin/views/core/advanced/cron/cron-query";
import type {
  RunCron,
  RunCronResult,
} from "@/views/admin/views/core/advanced/cron/run-action/run-cron";

import {
  cronQueryOptions,
  cronQueryRoot,
  fetchCronPageInBrowser,
} from "@/views/admin/views/core/advanced/cron/cron-query";
import { runCronInBrowser } from "@/views/admin/views/core/advanced/cron/run-action/run-cron";

import { fetchCronPageOnServer } from "./server";

/**
 * The cron list for a TanStack Start host: one query definition and one
 * mutation.
 *
 * Everything about *what* the list is comes from
 * `@/views/admin/views/core/advanced/cron/cron-query`, which is also what the
 * mounted `CronTableContent` is rendered from. This module supplies only the two
 * things that module cannot know: how to reach the API from a server that is
 * rendering a request, and what "refresh the table" means in a router that has a
 * query cache instead of `revalidatePath`.
 */

/**
 * The transport boundary, and the reason one query definition works in a loader
 * and in a component.
 *
 * Both branches call the Hono API directly - the server one from inside the
 * request being rendered, the browser one over the network to the same origin.
 * There is deliberately no `createServerFn` in between: a server function is a
 * `POST` back to the app that then calls Hono, so every sort and page of the
 * table would cost two round trips for a read the API is already the boundary
 * for. Nothing here needs a `Set-Cookie` copied onto the app's own response.
 *
 * The admin cookie still travels on both branches. On the server `fetcherServer`
 * forwards the one the page request arrived with; in the browser the call is
 * same-origin, so the browser attaches it without being asked.
 *
 * `createIsomorphicFn` is what makes that safe rather than merely tidy: the
 * Start compiler keeps only the branch belonging to the bundle it is building
 * and drops the other's import with it, so `./server` - and the `server-only`
 * marker at the top of it - never reaches the browser.
 *
 * Written out here rather than behind a shared helper, and that is the compiler
 * rather than taste: the transform matches the *chained call*, so a `.server(fn)`
 * passed as an ordinary argument somewhere else would leave the server import in
 * the client graph.
 */
const fetchCronPage: CronPageFetcher = createIsomorphicFn()
  .server(fetchCronPageOnServer)
  .client(fetchCronPageInBrowser);

/**
 * The cron list, as the one query definition every caller shares.
 *
 * `params` must be the *normalised* ones - `adminTableRouteParams` over the
 * route's validated search - because the cache key is built from them. Passing
 * raw URL values would make `?first=10` and no `first` two entries holding
 * identical rows, and the loader would fill one while the component read the
 * other.
 *
 * No `initialData`: the loader has already put the page in the entry this key
 * names and the SSR pass dehydrates it, so passing it again would be a second
 * copy of the same bytes that can disagree with the first.
 */
export const cronQuery = ({ params }: { params: CronParams }) =>
  cronQueryOptions({ fetchPage: fetchCronPage, params });

/**
 * Marks every cached page of the cron list stale.
 *
 * The whole family, by prefix - not the one page on screen. Running a job
 * changes `lastRun` and `nextRun`, so every other page and sort of the same list
 * is now wrong too, and the administrator reaches those by pressing a button
 * that reads from the cache.
 *
 * It is emphatically *not* `queryClient.invalidateQueries()` with no key: the
 * session, the messages and every other list the panel holds have not changed,
 * and refetching them because one cron job ran is the blunt version of the
 * `revalidatePath` this replaces.
 *
 * Invalidating rather than removing keeps the current rows on screen while the
 * fresh ones are fetched, instead of blanking the table under the button that
 * was just pressed.
 */
export const invalidateCron = async (queryClient: QueryClient): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: cronQueryRoot });

/**
 * Runs one job, then refreshes the table if it actually ran.
 *
 * Only on success, for the same reason the Next.js action only calls
 * `revalidatePath` on success: a refused run left `lastRun` exactly where it
 * was, and refetching would replace the rows underneath the error toast for no
 * change at all.
 */
export const runCron = async (
  queryClient: QueryClient,
  id: number,
): Promise<RunCronResult> => {
  const result = await runCronInBrowser(id);

  if (!result?.error) await invalidateCron(queryClient);

  return result;
};

/**
 * The callback `CronTableContent` takes, bound to the mounted router's cache.
 *
 * Memoised, which is the only reason this is a hook rather than a call at the
 * point of use: it is a prop on a table that re-renders on every navigation, and
 * a new function identity would reset the `useActionState` inside every row's
 * run button mid-run.
 */
export const useCronRunCallback = (): RunCron => {
  const queryClient = useQueryClient();

  return React.useMemo<RunCron>(
    () => async (id: number) => await runCron(queryClient, id),
    [queryClient],
  );
};
