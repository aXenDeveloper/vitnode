import type { QueryClient } from '@tanstack/react-query'
import type { DevicesFetcher } from '@vitnode/core/views/auth/settings/devices/devices-query'
import type {
  RevokeDevice,
  RevokeDeviceArgs,
  RevokeDeviceResult,
} from '@vitnode/core/views/auth/settings/devices/devices-revoke'

import { useQueryClient } from '@tanstack/react-query'
import { createIsomorphicFn } from '@tanstack/react-start'
import {
  DEVICES_QUERY_KEY,
  devicesQueryOptions,
  fetchDevicesInBrowser,
} from '@vitnode/core/views/auth/settings/devices/devices-query'
import {
  revokeDeviceInBrowser,
  shouldRefreshAfterRevoke,
} from '@vitnode/core/views/auth/settings/devices/devices-revoke'
import React from 'react'

import { fetchDevicesOnServer } from '#/server/devices.server'

/**
 * The visitor's signed-in devices, as this app's one query definition and one
 * revoke.
 *
 * Everything about *what* the list is - the request, the cache key, what counts
 * as a refusal - comes from
 * `@vitnode/core/views/auth/settings/devices/devices-query`, which is also what
 * the mounted `DevicesContent` is rendered from. This module supplies only the
 * two things core cannot know: how to reach the API from a server that is
 * rendering a request, and what "refresh the list" means in a router that has a
 * query cache instead of `revalidatePath`.
 *
 * The same shape as `#/lib/files/my-files`, deliberately - see the long note
 * there. What is different is only that this list has no parameters, so there is
 * one cache entry rather than a family.
 */

/**
 * The transport boundary, and the reason one query definition works in a loader
 * and in a component.
 *
 * Both branches call the Hono API directly - the server one from inside the
 * request being rendered, the browser one over the network to the same origin.
 * There is deliberately no `createServerFn` in between. A server function is a
 * `POST` back to this app that then calls Hono, so a refetch after a revoke would
 * cost two round trips for a read the API is already the boundary for. The
 * session read in `#/lib/session` *is* a server function, and the difference is
 * real rather than stylistic: nothing here needs a `Set-Cookie` copied onto this
 * app's own response.
 *
 * The cookies still travel on both branches, and this read needs two of them. On
 * the server `fetcherServer` forwards the whole `Cookie` header the page request
 * arrived with; in the browser the call is same-origin, so the browser attaches
 * it without being asked. That is what makes a `401` here mean "the session
 * ended" rather than "we forgot to say who was asking" - and what makes
 * `isCurrent` name the row the reader is actually sitting on.
 *
 * `createIsomorphicFn` is what makes that safe rather than merely tidy: the Start
 * compiler keeps only the branch belonging to the bundle it is building and drops
 * the other's import with it, so `devices.server.ts` - and the `server-only`
 * marker at the top of it - never reaches the browser.
 */
const fetchDevices: DevicesFetcher = createIsomorphicFn()
  .server(fetchDevicesOnServer)
  .client(fetchDevicesInBrowser)

/**
 * The devices list, as the one query definition every caller shares.
 *
 *     loader:     context.queryClient.ensureQueryData(devicesQuery())
 *     component:  useSuspenseQuery(devicesQuery())
 *     after a revoke: invalidate, and the component above refetches
 *
 * No `initialData`: the loader has already put the list in the entry this key
 * names and the SSR pass dehydrates it, so passing it again would be a second
 * copy of the same bytes that can disagree with the first.
 */
export const devicesQuery = () => devicesQueryOptions({ fetchDevices })

/**
 * Marks the cached devices list stale.
 *
 * One entry, named exactly - not `queryClient.invalidateQueries()` with no key.
 * The session, the messages and every other list this app holds are unaffected by
 * a device being signed out, and refetching them because of it is the blunt
 * version of the `revalidatePath('/[locale]/(main)', 'layout')` this replaces.
 *
 * The session entry in particular is deliberately left alone, and that is a
 * finding rather than an omission: the API refuses to revoke the current device
 * with a `400`, so no revoke this app can perform ends the session it is
 * performed from. There is no state in which the cached session is left falsely
 * authenticated by a successful revoke. Were that ever to change - were the route
 * to start accepting its own device id - this is the function that would have to
 * invalidate `SESSION_QUERY_KEY` alongside this one.
 *
 * Invalidating rather than removing keeps the current rows on screen while the
 * fresh ones are fetched, instead of blanking the list under the dialog that is
 * still closing.
 */
export const invalidateDevices = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY })

/**
 * Signs one device out, then refreshes the list if the list is now wrong.
 *
 * `shouldRefreshAfterRevoke` is core's rule, and the same one the Next.js server
 * action applies before it calls `revalidatePath`: a success and a stale row
 * (`404`, `400`) make the list wrong, while a `401`, `429` or `500` left it
 * exactly as it was. Refetching after one of those would send the same read
 * straight back into whatever refused the first - the rate limiter, or an ended
 * session - and replace the list the person is reading with an error.
 */
export const revokeDevice = async (
  queryClient: QueryClient,
  args: RevokeDeviceArgs,
): Promise<RevokeDeviceResult> => {
  const result = await revokeDeviceInBrowser(args)

  if (shouldRefreshAfterRevoke(result)) await invalidateDevices(queryClient)

  return result
}

/**
 * The one callback `DevicesContent` takes, bound to this router's cache.
 *
 * Memoised, which is the only reason this is a hook rather than a call at the
 * point of use: it is a prop on a list that re-renders on every navigation, and a
 * new function identity would remount the confirm dialog mid-revoke.
 */
export const useRevokeDeviceCallback = (): RevokeDevice => {
  const queryClient = useQueryClient()

  return React.useMemo(
    () => async (args: RevokeDeviceArgs) =>
      await revokeDevice(queryClient, args),
    [queryClient],
  )
}
