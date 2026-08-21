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
  options?: Omit<RequestInit, "body" | "headers"> & {
    /**
     * Next's own `fetch` extension, for cache tags and revalidation.
     *
     * Spelled out rather than inherited: Next augments the global `RequestInit`
     * from its own type declarations, and `@vitnode/core` compiles in contexts
     * where those are not loaded - `apps/api` is plain Node. Declaring the
     * shape here keeps every caller on the shared fetcher instead of reaching
     * for `fetch` directly to get one property.
     */
    next?: { revalidate?: false | number; tags?: string[] };
  };
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
  params,
  path,
  pluginId,
  prefixPath = "",
  query,
  withPagination = false,
}: Pick<
  RawApiFetchArgs,
  | "module"
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
    CONFIG.api.origin,
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

  const response = await fetch(url, {
    method: method.toUpperCase(),
    headers,
    body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
    ...options,
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
