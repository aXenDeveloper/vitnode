import { queryOptions } from "@tanstack/react-query";

import type { usersModule } from "@/api/modules/users/users.module";

import { CONFIG_PLUGIN } from "@/config";
import { clientModule, fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";

/**
 * The devices the signed-in visitor is logged in on, as one query definition.
 *
 * Everything about *what* that list is lives here and nowhere else: the request,
 * the shape that comes back, what counts as a refusal, and the cache entry the
 * whole thing lands in. A view renders whatever this produces and owns none of
 * it.
 *
 * The split is the one `my-files-query.ts` already paid for. When a component
 * built one request and a loader built another, the two agreed on the cache key
 * and on nothing else - so the server-rendered page came from one contract and
 * every navigation after hydration came from a second one with different
 * defaults and no status checking. Sharing a key is not sharing a contract.
 *
 * The one thing deliberately *not* fixed here is the transport: a loader running
 * on a server and a component running in a browser cannot reach the API the same
 * way. So {@link devicesQueryOptions} takes a `fetchDevices` and defaults it to
 * the browser's, which is the only one a shared module can assume.
 *
 * ## Hono is still the boundary
 *
 * Nothing below authorizes anything. `GET /api/@vitnode/core/users/devices`
 * derives the user from the session cookie, scopes the query to their sessions,
 * and marks the row matching the device cookie as `isCurrent` - so a request
 * this module builds for a visitor who has just been signed out comes back `401`,
 * and {@link DevicesRequestError} is what makes that a failed query rather than
 * an empty list.
 */

/**
 * The users module as a value the fetchers can carry without pulling the API
 * into either bundle. The module is imported as a *type* only, so route
 * literals, methods and response schemas all still infer; `clientModule`
 * supplies the one field the fetcher reads at runtime.
 */
export const usersModuleRef = clientModule<typeof usersModule>(
  CONFIG_PLUGIN.pluginId,
);

/** Which icon a row gets, and the only three values the API will send. */
export const DEVICE_TYPES = ["desktop", "tablet", "mobile"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

/**
 * One row of the list, as JSON delivers it.
 *
 * `expiresAt` and `lastSeen` are declared as `Date | string` because both are
 * true: the route's schema says `z.date()` and a Next.js Server Component that
 * awaited the fetcher is handed exactly that, while anything that crossed the
 * wire as JSON - the browser fetch, and the dehydrated SSR payload a TanStack
 * Start page rehydrates - has an ISO string. `DateFormat` accepts either, which
 * is why this is a widened type rather than a normalisation step.
 */
export interface Device {
  browser: string;
  deviceType: DeviceType;
  expiresAt: Date | string;
  ipAddress: string;
  /**
   * Whether this row is the session doing the asking.
   *
   * The API decides it, by comparing each row's `publicId` to the device cookie
   * on the request - so it is a property of *this* request rather than of the
   * device, and it is the reason the cookie has to reach the API on both
   * transports. A render that forwarded no cookie would mark every row
   * `isCurrent: false` and offer to revoke the session doing the rendering.
   *
   * `DELETE /users/devices/{publicId}` refuses that with a `400` regardless, so
   * this flag is what the list uses to not offer the button - not the rule
   * itself. See {@link isRevokableDevice}.
   */
  isCurrent: boolean;
  lastSeen: Date | string;
  os: string;
  publicId: string;
}

/** The list route's whole response. */
export interface DevicesApi {
  devices: Device[];
}

/**
 * The list, as arguments to whichever fetcher is carrying it.
 *
 * No parameters at all: the route takes none, and derives whose devices these
 * are from the session cookie.
 *
 * Worth reading against {@link devicesQueryKey}, which *does* carry a user id.
 * The two are not in tension - the key says which cache slot an answer is filed
 * under, this says what is asked for, and only the cookie says whose devices
 * come back. Adding an owner here would move authorization onto a value the
 * browser supplies.
 */
export const devicesRequest = () =>
  ({
    method: "get" as const,
    module: "users" as const,
    path: "/devices" as const,
  }) as const;

/** How the list is actually fetched. See {@link devicesQueryOptions}. */
export type DevicesFetcher = () => Promise<DevicesApi>;

/** The `name` every {@link DevicesRequestError} carries. See below. */
const DEVICES_REQUEST_ERROR = "DevicesRequestError";

/**
 * The devices API refused, and this is what it refused with.
 *
 * A thrown error rather than a returned one, because the alternative is the bug
 * this class exists to prevent. `getDevicesApi()` - the module this replaces -
 * called `res.json()` on whatever came back, and a `401`, `403` or `429` body
 * parses perfectly happily; read as a list it has no `devices`, so the page
 * rendered "No active devices." A visitor whose session had just ended, or who
 * had tripped the rate limiter, was told they were signed in nowhere - which is
 * the single most alarming thing this page can say, and it was saying it about
 * an outage.
 *
 * `status` is on the error rather than folded into the message so a caller can
 * tell the finite cases apart without parsing English: `401` and `403` mean the
 * session ended or was never allowed - the route guard is a navigation rule, not
 * the boundary, so this is the *authorization* answer and it can arrive on a
 * page the guard already let through. `429` is the rate limiter. A `500` never
 * reaches here at all: `rawApiFetch` throws on those with the body attached.
 *
 * Deliberately *not* a redirect to the login page. A failed read is not a
 * signed-out visitor - the same rule `#/lib/session` states at length - and the
 * guard on the route already owns that decision from the one canonical session
 * entry. Turning every API failure into a sign-out is how a rate limit becomes a
 * logout.
 *
 * Recognised by `name` rather than by `instanceof`, and that is not fussiness.
 * `@vitnode/core` is imported from `dist` by the apps and from `src` by its own
 * tests, so two copies of this class can exist in one process and `instanceof`
 * would answer `false` across them.
 */
export class DevicesRequestError extends Error {
  constructor(status: number) {
    super(`The devices API answered ${status} for the current user's devices.`);
    this.name = DEVICES_REQUEST_ERROR;
    this.status = status;
  }

  readonly status: number;
}

export const isDevicesRequestError = (
  error: unknown,
): error is DevicesRequestError =>
  error instanceof Error && error.name === DEVICES_REQUEST_ERROR;

/**
 * The list, fetched from the browser.
 *
 * `fetcherClient` builds the same same-origin `/api/@vitnode/core/users/devices`
 * URL every other VitNode client call uses, so the browser attaches the session
 * and device cookies itself - which is what makes `isCurrent` correct - and a
 * `429` is routed to the global rate-limit notice on the way through.
 */
export const fetchDevicesInBrowser: DevicesFetcher = async () => {
  const response = await fetcherClient(usersModuleRef, devicesRequest());

  if (!response.ok) throw new DevicesRequestError(response.status);

  return await response.json();
};

/**
 * Every visitor's devices, as one prefix above the per-owner entries.
 *
 * {@link devicesQueryKey} is one owner's entry - the thing a revoke invalidates.
 * This is the prefix above all of them, and its only caller is the public
 * identity cleanup in `tanstack/auth/queries`: a sign-out cannot name whose
 * partition to drop, because the point is that none of them stays behind.
 *
 * The entry it collects is the most sensitive private read in the public app -
 * operating systems, browsers, IP addresses and sign-in times - so leaving one
 * in a browser for `gcTime` after its owner signed out is exactly the residency
 * the AdminCP has refused since Stage 12. Partitioning by owner (below) already
 * stops the *next* visitor reading it; this is what stops it being there at all.
 */
export const DEVICES_IDENTITY_ROOT = ["devices", "user"] as const;

/**
 * The cache entry one visitor's list reads and writes, and the target an
 * invalidation names.
 *
 * A factory over the owner's id rather than the constant `["devices", "me"]` it
 * replaces. The reasoning was wrong in one specific way and it is worth keeping
 * the correction visible: it argued that the request carries no user, so the key
 * needs none, and that "the QueryClient is per request on the server and per
 * browser on the client, so there is no client holding two visitors' lists".
 *
 * The last clause is the mistake. *Per browser* is not per visitor - the browser
 * client is created once per document and outlives a sign-out:
 *
 *     A signs in  -> /settings/devices -> ["devices","me"] holds A's devices
 *     A signs out
 *     B signs in  -> /settings/devices -> the loader asks for the same entry
 *
 * which is already populated, and with `refetchOnMount` off nothing refetches
 * it. B would be shown A's operating systems, browsers and IP addresses without
 * a single request being made - so Hono never sees the read it would have
 * refused. Keyed by owner, B's entry is empty and the fetch happens.
 *
 * The locale is deliberately absent. Operating system, browser, IP address and
 * both timestamps are the same data in every language; the only translated
 * things on the page are the labels and the relative date, which the renderer
 * resolves from the provider it is under. A locale in the key would mean a
 * language switch silently refetched a list that had not changed.
 *
 * ## The id addresses a cache, it does not identify a caller
 *
 * `GET /users/devices` still takes no parameters and still derives the user from
 * the session cookie - {@link devicesRequest} is unchanged. So this id decides
 * which cache slot the answer is filed under and authorizes nothing; sending it
 * would turn a cache key into an access-control parameter, which is the one
 * thing it must never become.
 *
 * There is one entry per visitor and it has no sub-keys, so this is both the key
 * and the family an invalidation names.
 */
export const devicesQueryKey = (userId: number) =>
  [...DEVICES_IDENTITY_ROOT, userId] as const;

/**
 * The visitor's devices, as the one query definition every caller shares.
 *
 * A route loader warms it before the component renders:
 *
 *     context.queryClient.ensureQueryData(
 *       devicesQueryOptions({ fetchDevices, userId }),
 *     )
 *
 * and the component reads the very same options back:
 *
 *     const { data } = useSuspenseQuery(devicesQuery(userId))
 *
 * Same key, same request, same status checking - so the loader's list is the
 * list the component renders, and a revoke that invalidates
 * {@link devicesQueryKey} refetches through the identical contract.
 *
 * `userId` addresses the cache and nothing else - see {@link devicesQueryKey}.
 * It is required, and the whole parameter object with it, because there is no
 * honest default: falling back to a shared entry is the bug this closes. Both
 * callers take it from the one place that knows it, the `_authenticated` route
 * context, so the loader and the component cannot land on two partitions.
 *
 * `fetchDevices` is the seam. It defaults to the browser's fetcher, which is what
 * a hydrated page wants; an app that also fetches during SSR passes one that can
 * do both. It is a plain async function rather than anything framework-shaped, so
 * nothing about this module knows which framework is rendering it.
 *
 * ## It asks once
 *
 * `retry: false`, against Query's default of three attempts. Every failure this
 * read can produce is made worse by repeating it: a `429` is answered by sending
 * the same request two more times, which is the thing the limiter is asking this
 * app to stop doing, and a `401` is not going to become a `200` because we asked
 * again. The visitor retries by reloading - a decision they can make and a rate
 * limiter can see coming.
 *
 * No `staleTime`. Freshness is whatever the API's own caching gives, plus
 * VitNode's client defaults (`refetchOnMount` and `refetchOnWindowFocus` both
 * off), so a hydrated list is not refetched behind the reader; a revoke is what
 * makes it stale, explicitly.
 */
export const devicesQueryOptions = ({
  fetchDevices = fetchDevicesInBrowser,
  userId,
}: {
  fetchDevices?: DevicesFetcher;
  userId: number;
}) =>
  queryOptions({
    // `userId` is deliberately absent from the request: the owner comes from
    // the session cookie, on the server, on every call.
    queryFn: async () => await fetchDevices(),
    queryKey: devicesQueryKey(userId),
    retry: false,
    /** {@link RECORD_STALE_TIME} - A sign-in on another device adds a row this screen would otherwise never show. */
    staleTime: RECORD_STALE_TIME,
  });

/**
 * What the shared list accepts, and the reason it accepts only this.
 *
 * Typed as the factory's own return type on purpose: a caller cannot hand the
 * list a hand-rolled options object that happens to type-check, so "one query
 * definition" is enforced by the compiler rather than by review.
 */
export type DevicesQueryOptions = ReturnType<typeof devicesQueryOptions>;
