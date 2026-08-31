import "@tanstack/react-start/server-only";

import type { DevicesFetcher } from "@/views/auth/settings/devices/devices-query";

import {
  devicesRequest,
  DevicesRequestError,
  usersModuleRef,
} from "@/views/auth/settings/devices/devices-query";

import { fetcherServer } from "../fetcher/server";

/**
 * The visitor's devices, fetched during SSR.
 *
 * The request and the refusal check are the shared ones - the same two the
 * browser fetcher uses - so a list rendered on the server and a list refetched
 * after a revoke are the same request with the same failure semantics. Only the
 * *transport* is this module's, and it is the only part that genuinely cannot be
 * shared.
 *
 * `fetcherServer` rather than a bare `fetch`, and here it carries two things
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
export const fetchDevicesOnServer: DevicesFetcher = async () => {
  const response = await fetcherServer(usersModuleRef, devicesRequest());

  if (!response.ok) throw new DevicesRequestError(response.status);

  return await response.json();
};
