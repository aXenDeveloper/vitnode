import "@tanstack/react-start/server-only";

import { usersModule } from "@/api/modules/users/users.module";
import { DevicesRequestError } from "@/views/auth/settings/devices/devices-query";

import { fetcher } from "../fetcher/server";

/**
 * The visitor's devices, fetched during SSR.
 *
 * The route is written here rather than handed in, so the call says what it is
 * asking for. The refusal check is the shared one, so a list rendered on the
 * server and one refetched after a revoke fail the same way.
 *
 * `fetcher` rather than a bare `fetch`, and here it carries two things
 * rather than one:
 *
 * - **The session cookie**, which is whose devices these are. A render that
 *   forwarded nothing would be answered as an anonymous visitor - `401` - so
 *   this is the difference between a signed-in page and an error.
 * - **The device cookie**, which is which row is `isCurrent`. The API compares
 *   each row's `publicId` to it, so a render that dropped it would mark every
 *   row revokable and offer to sign the reader out of the session they are
 *   reading with. `buildForwardedHeaders` sends the whole `Cookie` header, so
 *   both travel together.
 *
 * It also resolves the API origin from the request being rendered, so a preview
 * deployment calls its own hostname rather than a configured one.
 *
 * Only ever reached through the isomorphic transport in `./index`, which is what
 * keeps this module - and the `server-only` marker above it - out of the browser
 * bundle.
 */
export const fetchDevicesOnServer = async () => {
  const response = await fetcher(usersModule, {
    method: "get",
    module: "users",
    path: "/devices",
  });

  if (!response.ok) throw new DevicesRequestError(response.status);

  return await response.json();
};
