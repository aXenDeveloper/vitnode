"use server";

import { revalidatePath } from "next/cache";

import { usersModule } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";

import type { RevokeDevice } from "./devices-revoke";

import {
  isDevicePublicId,
  revokeDeviceRequest,
  revokeResultFromStatus,
  shouldRefreshAfterRevoke,
} from "./devices-revoke";

/**
 * Signing one device out, from a Next.js page.
 *
 * The Next.js half of the revoke, and the only part of it that is Next.js's: the
 * request, the id check and the status mapping all come from `devices-revoke.ts`,
 * which is also what the TanStack Start app's browser fetch is built from. So a
 * revoke means the same thing in both applications, and the `RevokeDevice` type
 * this satisfies is the prop the shared button takes.
 *
 * What remains here is `revalidatePath`, which exists only on a server and is how
 * a Next.js page refreshes. Its TanStack Start counterpart is a query
 * invalidation of `DEVICES_QUERY_KEY`; both are applied on the same condition -
 * `shouldRefreshAfterRevoke` - so neither refreshes a list the API left
 * untouched. A `429` answered by re-rendering the page would send the same read
 * straight back into the limiter, and a `401` would replace the list with a
 * not-found while the person is reading it.
 *
 * The layout, not the page: revoking a device changes the sessions the header and
 * the sidebar are rendered from as well as the list, and `'layout'` is what the
 * previous version already said.
 */
export const revokeDeviceAction: RevokeDevice = async ({ publicId }) => {
  if (!isDevicePublicId(publicId)) return { error: { status: 400 } };

  const res = await fetcher(usersModule, revokeDeviceRequest({ publicId }));
  const result = revokeResultFromStatus(res.status);

  if (shouldRefreshAfterRevoke(result)) {
    revalidatePath("/[locale]/(main)", "layout");
  }

  return result;
};
