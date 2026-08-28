import { fetcherClient } from "@/lib/fetcher-client";

import type { Device } from "./devices-query";

import { usersModuleRef } from "./devices-query";

/**
 * Signing one device out, as a contract both frameworks satisfy.
 *
 * The API already accepts an authenticated `DELETE` from anywhere: it derives the
 * user from the session cookie, scopes the lookup to their own sessions, and
 * refuses the device the request itself is coming from. So the browser calls it
 * directly - same origin, cookie attached by the browser itself - and there is
 * deliberately no server function in between. A server function here would be a
 * `POST` back to the app that then calls Hono, which is two round trips and a
 * second place to get the semantics wrong, in exchange for nothing: this
 * mutation needs no server-only secret, and it sets no cookie that would have to
 * be copied onto a response.
 *
 * The Next.js app keeps its server action, which is not a contradiction. There
 * the revoke has to end with `revalidatePath`, and that only exists on a server;
 * see `revoke-action.server.ts`. What both sides share is the *shape* - the
 * callback type below, the request, the status mapping and the refresh rule - so
 * one list component can be handed either.
 *
 * ## What it cannot do
 *
 * Revoke the current device. `DELETE /users/devices/{publicId}` compares the id
 * to the requester's own device cookie and answers `400` before it deletes
 * anything, so there is no path through this module that can end the session
 * making the call. That is why nothing here touches the session cache: the one
 * mutation that would invalidate it is the one the API refuses. See
 * {@link isRevokableDevice} and {@link REVOKE_CURRENT_DEVICE_STATUS}.
 *
 * The guard has no gap, and that is worth stating because "the device cookie was
 * missing, so no row was current" would be one. `SessionModel.getUser()` - which
 * is what fills `c.get("user")` for every request - resolves the device from that
 * same cookie and looks the session up by `(token, deviceId)`. A request with no
 * usable device cookie therefore has no user at all and is answered `401` before
 * either route reads the cookie. So on every response these two routes can
 * actually produce, the cookie names the device holding the requesting session:
 * exactly one row is `isCurrent`, and it is precisely the one that cannot be
 * revoked.
 */

/** Signing out one device. The id is the row's own `publicId`. */
export interface RevokeDeviceArgs {
  publicId: string;
}

/**
 * The finite outcome of one revoke.
 *
 * A closed result rather than a rejection, so a Next.js server action and a
 * browser fetch are the same prop: the caller is standing in a confirm dialog
 * and has to say something either way. `status` carries which refusal it was,
 * because the three that matter read differently - see
 * {@link REVOKE_CURRENT_DEVICE_STATUS}.
 */
export interface RevokeDeviceResult {
  data?: true;
  error?: {
    status: number;
  };
}

/**
 * What the shared list is handed instead of a mutation.
 *
 * A plain async function returning a closed result. Nothing framework-shaped
 * survives in either direction.
 */
export type RevokeDevice = (
  args: RevokeDeviceArgs,
) => Promise<RevokeDeviceResult>;

/**
 * The status the API answers when asked to revoke the device doing the asking.
 *
 * Named rather than spelled `400` at the call site because it is the one refusal
 * with a meaning instead of a cause: the request was well-formed and the device
 * exists, and the answer is "not that one". The list does not offer the button
 * for it, so reaching this means the row was stale - the same device cookie was
 * re-issued, or another tab signed in - and the honest repair is to refetch,
 * which is what {@link shouldRefreshAfterRevoke} does.
 */
export const REVOKE_CURRENT_DEVICE_STATUS = 400;

/**
 * Whether a row may be signed out at all.
 *
 * The current device may not, and the API is the one enforcing it. This is the
 * *display* half of that rule, kept next to the request so the two cannot drift:
 * a list that offered the button anyway would put a `400` behind it, and the only
 * thing the person would learn is that something went wrong.
 */
export const isRevokableDevice = (device: Pick<Device, "isCurrent">): boolean =>
  !device.isCurrent;

/**
 * The public ids this module will send, and the shape of one it will not.
 *
 * `randomBytes(16).toString("hex")` is what `DeviceModel` mints, so a real id is
 * 32 hex characters; the pattern is deliberately wider than that - any URL-safe
 * token up to 128 characters - so a deployment whose ids were minted by an
 * earlier scheme keeps working. What it rules out is the two shapes that are
 * never an id and would be sent into a path segment: empty, and anything
 * carrying `/`, `.` or a percent-escape.
 *
 * Refusing locally rather than letting the API answer is the point. The route's
 * own `z.string()` accepts `""` and `../session`, and the fetcher interpolates
 * the value into `/devices/{publicId}` - so an empty id addresses the *list*
 * route with a `DELETE` and a traversal addresses a sibling. Both come back as
 * some other status, which the dialog would report as a mysterious failure.
 */
const DEVICE_PUBLIC_ID = /^[A-Za-z0-9_-]{1,128}$/;

export const isDevicePublicId = (publicId: string): boolean =>
  DEVICE_PUBLIC_ID.test(publicId);

/**
 * One revoke, as arguments to whichever fetcher is carrying it.
 *
 * Shared with the Next.js server action, so a revoke is the same request in both
 * applications rather than two places that merely look alike.
 */
export const revokeDeviceRequest = ({ publicId }: RevokeDeviceArgs) =>
  ({
    args: { params: { publicId } },
    method: "delete" as const,
    module: "users" as const,
    path: "/devices/{publicId}" as const,
  }) as const;

/**
 * The result a refused status becomes.
 *
 * Its own function because both transports have to agree on it, and because
 * "which statuses count as done" is the kind of rule that grows a second
 * spelling the moment it is inlined twice. `200` is the only success the route
 * declares - it answers with an empty body - and everything else is the status,
 * verbatim, for the caller to phrase.
 */
export const revokeResultFromStatus = (status: number): RevokeDeviceResult =>
  status === 200 ? { data: true } : { error: { status } };

/**
 * Signs one device out from the browser.
 *
 * Never rejects, and that is the contract rather than an oversight. Every way
 * this can fail is something the person has to be told in the dialog they are
 * standing in, and a rejected promise would have to be caught by every caller to
 * say the same thing.
 *
 * The `catch` is why the `500` case is not special: `rawApiFetch` throws on those
 * with the failing URL and the server's own error text attached, and that throw
 * is a server error like any other - reported as `status: 500`, not as a crashed
 * dialog.
 *
 * A locally-refused id is reported as `400`, which is both the honest status -
 * the request was malformed, and never sent - and the same one the route's own
 * schema would have produced had it been. It coincides with
 * {@link REVOKE_CURRENT_DEVICE_STATUS} and that costs nothing: both mean the row
 * on screen does not match the server, and both are answered by refetching.
 */
export const revokeDeviceInBrowser: RevokeDevice = async ({ publicId }) => {
  if (!isDevicePublicId(publicId)) return { error: { status: 400 } };

  try {
    const response = await fetcherClient(usersModuleRef, {
      ...revokeDeviceRequest({ publicId }),
      options: { credentials: "include" },
    });

    return revokeResultFromStatus(response.status);
  } catch {
    return { error: { status: 500 } };
  }
};

/**
 * Whether a finished revoke changed what the list is showing.
 *
 * Two cases, and the second is the one worth stating:
 *
 * - **It worked.** The row is gone, so the list is stale.
 * - **`404`, or `400`.** The row was already wrong. A device somebody else
 *   revoked first is a `404`, and a row the list believed was revokable but the
 *   API considers current is a `400` - in both cases what is on screen does not
 *   match the server, and refetching is the repair.
 *
 * A `401`, `403`, `429` or `500` is deliberately *not* a refresh. Nothing was
 * deleted, and the refetch would be a second request into whatever refused the
 * first - a rate limiter answered by immediately asking again, or an ended
 * session answered by a second `401` that blanks the list the person is looking
 * at. The dialog says it failed and the list stays exactly as it was.
 *
 * The Next.js action applies the same rule before it calls `revalidatePath`, so
 * both frameworks refresh on the same condition.
 */
export const shouldRefreshAfterRevoke = ({
  data,
  error,
}: RevokeDeviceResult): boolean => {
  if (data) return true;

  return (
    error?.status === 404 || error?.status === REVOKE_CURRENT_DEVICE_STATUS
  );
};
