/**
 * The per-request contract VitNode is written against.
 *
 * Types only, no implementation and no `next/*`, so this module is safe
 * everywhere the framework-independent layers are: `apps/api` (a plain
 * `@hono/node-server` process), drizzle-kit, and the browser. It is the whole
 * vocabulary a VitNode caller needs for request state - nothing above this file
 * names Next.
 *
 * The surface is deliberately smaller than what any framework offers. Every
 * member is something core code already reads or writes today: the incoming
 * headers, the cookie jar, and "wait for a real request before continuing".
 * Anything wider would be a Next.js shape with a different name on it.
 */

/**
 * The incoming request's headers.
 *
 * The web `Headers` interface minus its mutators, because what a runtime hands
 * out is a view of what the client sent - writing to it either throws or
 * silently does nothing. Both Next's `ReadonlyHeaders` and a plain `Headers`
 * satisfy this, so an adapter never has to copy.
 */
export type RequestHeaders = Omit<Headers, "append" | "delete" | "set">;

/** A cookie as it arrives on the request: no attributes, only a value. */
export interface RequestCookie {
  name: string;
  value: string;
}

/**
 * The `Set-Cookie` attributes VitNode writes.
 *
 * The subset of the serialisation options {@link RequestCookieStore.set} is
 * actually called with in this codebase, rather than whatever the framework
 * underneath happens to accept. Adding one is cheap; the point is that the list
 * is stated here instead of inherited.
 */
export interface RequestCookieAttributes {
  domain?: string;
  expires?: Date | number;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "lax" | "none" | "strict" | boolean;
  secure?: boolean;
}

/** Reads the request's cookies; writes cookies onto the response. */
export interface RequestCookieStore {
  readonly delete: (name: string) => void;
  readonly get: (name: string) => RequestCookie | undefined;
  readonly getAll: () => RequestCookie[];
  readonly has: (name: string) => boolean;
  readonly set: (
    name: string,
    value: string,
    attributes?: RequestCookieAttributes,
  ) => void;
  /** Serialised as a `Cookie:` **request** header value, ready to forward. */
  readonly toString: () => string;
}

/**
 * One framework's implementation of the contract.
 *
 * Three verbs, and every one of them is asynchronous because reading request
 * state is: a framework that keeps the current request in async-local storage
 * resolves it per call, and an adapter that had to await a store internally
 * would have nowhere to do it behind a synchronous signature.
 */
export interface RequestAdapter {
  /**
   * Resolves once an actual request is in flight.
   *
   * Under a framework that prerenders (Next's `connection()`) this never
   * resolves during the prerender pass and resolves immediately while serving,
   * which is what keeps a build from filling a cache entry it has no request to
   * fill it with. An adapter with no prerender pass resolves immediately.
   */
  readonly awaitRequest: () => Promise<void>;
  readonly getCookies: () => Promise<RequestCookieStore>;
  readonly getHeaders: () => Promise<RequestHeaders>;
  /** Identifies the adapter in errors and tests. */
  readonly name: string;
}
