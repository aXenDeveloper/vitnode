import { CONFIG } from "../config";
import { buildSearchParams } from "./helpers";

export interface RawApiFetchArgs {
  additionalHeaders?: HeadersInit;
  body?: unknown;
  /**
   * Raw `multipart/form-data` body. When set the JSON `Content-Type` is
   * omitted so the runtime can add the multipart boundary.
   */
  formData?: FormData;
  method: string;
  /** Module path under the plugin, e.g. `admin/content/articles`. */
  module: string;
  /**
   * Extra `fetch` init, for the things a caller genuinely owns - `credentials`,
   * and an {@link AbortSignal} from a cancellable read.
   *
   * `method` is omitted alongside `body` and `headers` because the spread below
   * comes *last*: without it, an `options.method` would silently win over the
   * `method` this call was built from, and a `get` would leave as a `post`. The
   * three fields this function computes are the three it does not accept.
   */
  options?: Omit<RequestInit, "body" | "headers" | "method">;
  /**
   * Origin to build the URL against, instead of `NEXT_PUBLIC_API_URL`.
   *
   * For a runtime that serves the API itself, the right origin is the one the
   * request being handled arrived on: it is only knowable per request, and on a
   * preview deployment it is a hostname nobody configured. Left unset in the
   * browser, which keeps reading `CONFIG.api`.
   */
  origin?: string;
  params?: Record<string, unknown>;
  /** Route path within the module, e.g. `/` or `/{id}`. */
  path: string;
  pluginId: string;
  prefixPath?: string;
  query?: Record<string, string | string[] | undefined>;
  withPagination?: boolean;
}

export const buildApiUrl = ({
  module,
  origin,
  params,
  path,
  pluginId,
  prefixPath = "",
  query,
  withPagination = false,
}: Pick<
  RawApiFetchArgs,
  | "module"
  | "origin"
  | "params"
  | "path"
  | "pluginId"
  | "prefixPath"
  | "query"
  | "withPagination"
>): URL => {
  let currentPath = path;

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      currentPath = currentPath.replaceAll(`{${key}}`, String(value));
    }
  }

  const formattedPath = currentPath.startsWith("/")
    ? currentPath
    : `/${currentPath}`;

  const url = new URL(
    `/api/${pluginId}${prefixPath}/${module}${formattedPath === "/" ? "" : formattedPath}`,
    origin ?? CONFIG.api.origin,
  );

  if (query) {
    url.search = buildSearchParams({
      ...query,
      ...(withPagination && {
        first: query.last ? undefined : (query.first ?? "10"),
        search: query.search ?? "",
      }),
    }).toString();
  }

  return url;
};

/**
 * The untyped core of the fetcher: URL building, headers, and the error
 * logging every VitNode API call shares.
 *
 * `coreFetcher` wraps this with the route-literal type inference, and the
 * Content Engine wraps it with content-type schemas - both get the same
 * request behaviour without a second implementation.
 */
export const rawApiFetch = async ({
  additionalHeaders = {},
  body,
  formData,
  method,
  options,
  ...urlArgs
}: RawApiFetchArgs): Promise<Response> => {
  const url = buildApiUrl(urlArgs);

  const headers = new Headers({
    ...(formData ? {} : { "Content-Type": "application/json" }),
    ...additionalHeaders,
  });

  // `options` first, so the three fields this function computes always win. It
  // used to be spread last, which made `method` reachable from a caller reaching
  // past the type - a `get` could leave as a `post`. `body` and `headers` were
  // already protected by the `Omit`; `method` is now too, and the order here is
  // what makes that true at runtime rather than only in the type.
  const response = await fetch(url, {
    ...options,
    method: method.toUpperCase(),
    headers,
    body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
  });

  if (response.status === 500) {
    const errorText = await response.text();
    throw new Error(
      // The body first, `statusText` only as a fallback. It used to be
      // `statusText ?? errorText`, which never fell through - `statusText` is
      // essentially always a non-empty string - so the one part that says *what*
      // went wrong was discarded on every 500.
      `${response.status} - ${url.toString()}\n${errorText.trim() === "" ? response.statusText : errorText}`,
    );
  }

  if (response.status >= 400) {
    // Clone so the response body stays readable for the caller
    const errorText = await response.clone().text();
    // eslint-disable-next-line no-console
    console.error(
      `\x1b[34m[VitNode - API]\x1b[0m \x1b[31m${response.status}\x1b[0m - \x1b[33m${url.toString()}\x1b[0m\n\x1b[36mError: ${errorText}\x1b[0m`,
    );
  }

  return response;
};
