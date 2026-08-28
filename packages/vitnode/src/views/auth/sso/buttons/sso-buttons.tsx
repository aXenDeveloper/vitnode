import { getMiddlewareApi } from "@/lib/api/get-middleware-api";

import { normalizeSSOProviders } from "../providers";
import { SSOButtonsClient } from "./client";

export { SSOButtonsSkeleton } from "./sso-buttons-content";

/**
 * The provider row for Next.js: read the deployment configuration, render the
 * shared row.
 *
 * A Server Component only because of the read - `getMiddlewareApi` waits for a
 * real request, which is why both auth pages put this inside a `<Suspense>`.
 * The row itself renders nothing when no adapter is registered.
 */
export const SSOButtons = async () => {
  const { sso } = await getMiddlewareApi();

  return <SSOButtonsClient providers={normalizeSSOProviders(sso)} />;
};
