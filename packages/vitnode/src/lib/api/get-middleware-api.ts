import { middlewareModule } from "@/api/modules/middleware/middleware.module";
import { setCacheEntryLife } from "@/framework/cache";
import { awaitRequest } from "@/framework/request";
import { coreFetcher } from "@/lib/fetcher/core";

/**
 * Deployment configuration for the auth screens: which SSO adapters are
 * registered, whether an email adapter exists, and the public captcha key.
 *
 * Every field is derived from `vitnode.api.config.ts`, so the response is the
 * same for every visitor and only changes on deploy - hence `setCacheEntryLife("max")`.
 *
 * Goes through `coreFetcher` rather than `fetcher` deliberately: `fetcher`
 * forwards the request's cookies and headers, and `use cache` cannot enclose a
 * runtime read. Nothing on this route is per-user, so there is nothing to
 * forward.
 */
const fetchMiddlewareApi = async () => {
  "use cache";
  setCacheEntryLife("max");

  const res = await coreFetcher(middlewareModule, {
    path: "/",
    method: "get",
    module: "middleware",
  });

  return await res.json();
};

/**
 * `awaitRequest()` first, so the entry above is filled by the first real request
 * instead of during `next build`.
 *
 * Cache Components fills a `use cache` entry while prerendering, and filling
 * this one means an HTTP request to `NEXT_PUBLIC_API_URL` from the build itself.
 * In the single-app deployment that origin *is* the app being built, so nothing
 * is listening and the prerender dies with `ECONNREFUSED`; in the split
 * deployment it is a separate service a build machine - CI, a Docker image, a
 * first deploy - has no reason to reach. Neither is a misconfiguration that
 * could be fixed, so the read waits for a request that can actually answer it.
 *
 * The cache still does its job either way: one API call per deploy, not one per
 * visitor. What it gives up is a place in the static shell, so every caller has
 * to sit inside a `<Suspense>` boundary - or its route has to be a documented
 * `instant = false`.
 */
export const getMiddlewareApi = async () => {
  await awaitRequest();

  return await fetchMiddlewareApi();
};
