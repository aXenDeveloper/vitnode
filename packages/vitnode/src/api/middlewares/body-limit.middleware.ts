import type { Context, Next } from "hono";

/**
 * Hono's `bodyLimit`, re-attaching a buffered body with
 * `new Request(url, init)` instead of `new Request(request, init)`.
 *
 * The second form throws on the request objects TanStack Start's server hands
 * the API, so every request without a `Content-Length` - a bodiless `DELETE`
 * from a browser, a chunked upload - was answered `500` before it reached a
 * route.
 */
export const bodyLimitMiddleware = ({
  maxSize,
  onError,
}: {
  maxSize: number;
  onError: (c: Context) => Promise<Response> | Response;
}) => {
  return async (c: Context, next: Next) => {
    const raw = c.req.raw;
    if (!raw.body) return next();

    const length = raw.headers.get("content-length");
    if (length !== null && !raw.headers.has("transfer-encoding")) {
      return Number.parseInt(length, 10) > maxSize ? onError(c) : next();
    }

    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    const reader = raw.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxSize) {
        await reader.cancel();

        return onError(c);
      }
      chunks.push(value);
    }

    c.req.raw = new Request(raw.url, {
      method: raw.method,
      headers: raw.headers,
      signal: raw.signal,
      body: size > 0 ? new Blob(chunks) : undefined,
    });

    return next();
  };
};
