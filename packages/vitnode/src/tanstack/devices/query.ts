import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import React from "react";

import type { DevicesFetcher } from "@/views/auth/settings/devices/devices-query";
import type {
  RevokeDevice,
  RevokeDeviceArgs,
  RevokeDeviceResult,
} from "@/views/auth/settings/devices/devices-revoke";

import {
  devicesQueryKey,
  devicesQueryOptions,
  fetchDevicesInBrowser,
} from "@/views/auth/settings/devices/devices-query";
import {
  revokeDeviceInBrowser,
  shouldRefreshAfterRevoke,
} from "@/views/auth/settings/devices/devices-revoke";

import { fetchDevicesOnServer } from "./server";

/**
 * The visitor's signed-in devices, as one query definition and one revoke, for a
 * TanStack Start host.
 *
 * Everything about *what* the list is - the request, the cache key, what counts
 * as a refusal - comes from `@/views/auth/settings/devices/devices-query`, which
 * is also what the mounted `DevicesContent` is rendered from. This module
 * supplies only the two things that module cannot know: how to reach the API
 * from a server that is rendering a request, and what "refresh the list" means
 * in a router that has a query cache instead of `revalidatePath`.
 *
 * The same shape as `../files`, deliberately - see the long note there. What is
 * different is only that this list has no parameters, so one visitor has one
 * cache entry rather than a family of pages and sorts.
 */

/**
 * The transport boundary, and the reason one query definition works in a loader
 * and in a component.
 *
 * Both branches call the Hono API directly - the server one from inside the
 * request being rendered, the browser one over the network to the same origin.
 * There is deliberately no `createServerFn` in between. A server function is a
 * `POST` back to the app that then calls Hono, so a refetch after a revoke would
 * cost two round trips for a read the API is already the boundary for. A session
 * read *is* a server function, and the difference is real rather than stylistic:
 * nothing here needs a `Set-Cookie` copied onto the app's own response.
 *
 * The cookies still travel on both branches, and this read needs two of them. On
 * the server `fetcherServer` forwards the whole `Cookie` header the page request
 * arrived with; in the browser the call is same-origin, so the browser attaches
 * it without being asked. That is what makes a `401` here mean "the session
 * ended" rather than "we forgot to say who was asking" - and what makes
 * `isCurrent` name the row the reader is actually sitting on.
 *
 * `createIsomorphicFn` is what makes that safe rather than merely tidy: the
 * Start compiler keeps only the branch belonging to the bundle it is building
 * and drops the other's import with it, so `./server` - and the `server-only`
 * marker at the top of it - never reaches the browser. It is written out here
 * rather than behind a shared helper because the transform matches the *chained
 * call*; see the note in `../files/query`.
 */
const fetchDevices: DevicesFetcher = createIsomorphicFn()
  .server(fetchDevicesOnServer)
  .client(fetchDevicesInBrowser);

/**
 * The devices list, as the one query definition every caller shares.
 *
 *     loader:     context.queryClient.ensureQueryData(devicesQuery(userId))
 *     component:  useSuspenseQuery(devicesQuery(userId))
 *     after a revoke: invalidate that visitor's entry, and it refetches
 *
 * `userId` is the *cache* owner and nothing more. It comes from the
 * authenticated boundary's own state, read from the one canonical session query
 * rather than from a second source - and it never reaches the API:
 * `GET /users/devices` takes no arguments at all and derives the owner from the
 * session cookie. See `devicesQueryKey` for why the entry has to be partitioned,
 * and what went wrong when it was not.
 *
 * No `initialData`: the loader has already put the list in the entry this key
 * names and the SSR pass dehydrates it, so passing it again would be a second
 * copy of the same bytes that can disagree with the first.
 */
export const devicesQuery = (userId: number) =>
  devicesQueryOptions({ fetchDevices, userId });

/**
 * Marks one visitor's cached devices list stale.
 *
 * One entry, named exactly - not `queryClient.invalidateQueries()` with no key.
 * The session, the messages and every other list the app holds are unaffected by
 * a device being signed out, and refetching them because of it is the blunt
 * version of the `revalidatePath('/[locale]/(main)', 'layout')` this replaces.
 *
 * Scoped to `userId` for the same reason the key is. A long-lived browser client
 * can still hold a previous visitor's partition; it is unreachable - every
 * authenticated route builds its key from the current session - and refetching
 * it would be a request on behalf of somebody who has signed out.
 *
 * The session entry in particular is deliberately left alone, and that is a
 * finding rather than an omission: the API refuses to revoke the current device
 * with a `400`, so no revoke the app can perform ends the session it is
 * performed from. There is no state in which the cached session is left falsely
 * authenticated by a successful revoke. Were that ever to change - were the
 * route to start accepting its own device id - this is the function that would
 * have to invalidate the session key alongside this one.
 *
 * Invalidating rather than removing keeps the current rows on screen while the
 * fresh ones are fetched, instead of blanking the list under the dialog that is
 * still closing.
 */
export const invalidateDevices = async (
  queryClient: QueryClient,
  userId: number,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: devicesQueryKey(userId) });

/**
 * Signs one device out, then refreshes the list if the list is now wrong.
 *
 * `shouldRefreshAfterRevoke` is the shared rule, and the same one the Next.js
 * server action applies before it calls `revalidatePath`: a success and a stale
 * row (`404`, `400`) make the list wrong, while a `401`, `429` or `500` left it
 * exactly as it was. Refetching after one of those would send the same read
 * straight back into whatever refused the first - the rate limiter, or an ended
 * session - and replace the list the person is reading with an error.
 */
export const revokeDevice = async (
  queryClient: QueryClient,
  userId: number,
  args: RevokeDeviceArgs,
): Promise<RevokeDeviceResult> => {
  const result = await revokeDeviceInBrowser(args);

  if (shouldRefreshAfterRevoke(result)) {
    await invalidateDevices(queryClient, userId);
  }

  return result;
};

/**
 * The one callback `DevicesContent` takes, bound to the mounted router's cache
 * and to the visitor whose partition of it the revoke may refresh.
 *
 * `userId` is taken as an argument rather than read here: the route reads it
 * from the authenticated boundary once in its loader and hands the same value to
 * the query options and to this hook, so the entry the loader filled is the
 * entry a revoke marks stale. It scopes an invalidation and nothing else - the
 * revoke request carries a device's `publicId` and no owner.
 *
 * Memoised, which is the only reason this is a hook rather than a call at the
 * point of use: it is a prop on a list that re-renders on every navigation, and
 * a new function identity would remount the confirm dialog mid-revoke.
 */
export const useRevokeDeviceCallback = (userId: number): RevokeDevice => {
  const queryClient = useQueryClient();

  return React.useMemo(
    () => async (args: RevokeDeviceArgs) =>
      await revokeDevice(queryClient, userId, args),
    [queryClient, userId],
  );
};
