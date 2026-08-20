/**
 * Per-request state - cookies, headers, and "wait for a real request" - read
 * through VitNode rather than through Next.
 *
 * Importing this module installs the Next.js adapter as the default, so server
 * code gets working `requestHeaders()` / `requestCookies()` / `awaitRequest()`
 * with no setup. An application on another host framework calls
 * `setRequestAdapter()` with its own adapter, which takes precedence.
 *
 * `./next` is the only file behind this barrel that touches `next/*`, and it
 * carries `server-only` - so this module does too. Code that has to load in
 * plain Node (`content/`, `content/server/`, drizzle-kit) must import
 * `./runtime` and `./types` directly instead, both of which are framework-free.
 *
 * The same split as `framework/cache`, for the same reason.
 */
import { nextRequestAdapter } from "./next";
import { setDefaultRequestAdapter } from "./runtime";

setDefaultRequestAdapter(nextRequestAdapter);

export { nextRequestAdapter } from "./next";
export {
  awaitRequest,
  forwardApiRequestHeaders,
  getRequestAdapter,
  hasRequestAdapter,
  requestCookies,
  requestHeaders,
  resetRequestAdapter,
  setDefaultRequestAdapter,
  setRequestAdapter,
} from "./runtime";
export type {
  RequestAdapter,
  RequestCookie,
  RequestCookieAttributes,
  RequestCookieStore,
  RequestHeaders,
} from "./types";
