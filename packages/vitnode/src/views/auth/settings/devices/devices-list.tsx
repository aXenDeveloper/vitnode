import { notFound } from "next/navigation";

import { usersModule } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";

import { DevicesContent } from "./devices-content";
import { devicesRequest } from "./devices-query";
import { revokeDeviceAction } from "./revoke-action.server";

/**
 * The Next.js half of `/settings/devices`: read the list, then hand it to the
 * shared one.
 *
 * Everything Next.js about the feature is in this file. It is a Server
 * Component, so it fetches with `fetcher()` - which reads the visitor's session
 * and device cookies through `next/headers`, and the device cookie is what makes
 * `isCurrent` correct - and answers a refusal with `notFound()`, which only
 * exists here. The revoke callback is the server action, which ends in
 * `revalidatePath`: the one step that cannot be shared.
 *
 * The request itself is *not* Next.js's. `devicesRequest()` is the same function
 * the TanStack Start transport calls, so both applications ask the API for the
 * same thing rather than in two places that merely look alike.
 *
 * ## A refused read is not an empty list
 *
 * This used to be `getDevicesApi()`, which called `res.json()` on whatever came
 * back and handed the result straight to the list. A `401`, `403` or `429` body
 * parses perfectly happily and has no `devices` in it, so the page either
 * rendered "No active devices." or crashed reading `.length` of `undefined` -
 * and the first of those is the most alarming thing this page can say, said about
 * an outage. `notFound()` is the same answer `/files` gives to the same problem:
 * a finite, honest "this page is not available", instead of a confident lie about
 * the visitor's sessions.
 */
export const DevicesList = async () => {
  const res = await fetcher(usersModule, devicesRequest());

  if (res.status !== 200) {
    return notFound();
  }

  const { devices } = await res.json();

  return <DevicesContent devices={devices} onRevoke={revokeDeviceAction} />;
};
