import "server-only";
import * as nextHeaders from "next/headers";
import * as nextServer from "next/server";

import type { RequestAdapter, RequestCookieStore } from "./types";

/**
 * The Next.js request adapter - the **only** module in `@vitnode/core` that
 * imports `next/headers` or `next/server`.
 *
 * That is the whole point of the `framework/request` layer: core code reads
 * request state through {@link RequestAdapter}, and swapping host frameworks
 * means writing a sibling of this file rather than editing every call site.
 * `framework/request/boundaries.test.ts` asserts the rule instead of trusting
 * it, and `server-only` here keeps the whole layer out of client bundles.
 *
 * ## Why namespace imports
 *
 * `import * as` rather than named imports, because a suite that exercises one
 * verb mocks `next/headers` with a factory holding only the function it cares
 * about. Named imports are resolved when this module is evaluated, so a partial
 * mock would fail the *import* over a function the test never calls. A namespace
 * access fails only if that function is actually reached, which is the behaviour
 * a partial mock is asking for.
 */

type NextCookieStore = Awaited<ReturnType<typeof nextHeaders.cookies>>;

/**
 * Delegates rather than handing Next's own store out, so nothing downstream can
 * reach for a Next-only member and quietly re-couple itself. `set` and `delete`
 * still write through to the same response Next would have written to.
 */
const toCookieStore = (store: NextCookieStore): RequestCookieStore => ({
  delete: name => {
    store.delete(name);
  },
  get: name => store.get(name),
  getAll: () => store.getAll(),
  has: name => store.has(name),
  set: (name, value, attributes) => {
    store.set(name, value, attributes);
  },
  toString: () => store.toString(),
});

export const nextRequestAdapter: RequestAdapter = {
  /**
   * `connection()`, whose contract is exactly the one
   * {@link RequestAdapter.awaitRequest} describes: it never resolves during a
   * prerender and resolves immediately while serving a request.
   */
  awaitRequest: async () => {
    await nextServer.connection();
  },

  getCookies: async () => toCookieStore(await nextHeaders.cookies()),

  /**
   * Next's `ReadonlyHeaders` is the web `Headers` interface with its mutators
   * stubbed out, so it already satisfies {@link RequestHeaders} - no copy, and
   * no chance of handing out a snapshot that drifts from the request.
   */
  getHeaders: async () => await nextHeaders.headers(),

  name: "next",
};
