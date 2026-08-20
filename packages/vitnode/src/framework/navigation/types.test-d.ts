/**
 * The assertion that makes `./types` more than documentation.
 *
 * `./next` is checked against {@link NavigationAdapter} as a whole, so a
 * Next-shaped signature cannot drift into the adapter unnoticed: widen a
 * parameter, drop an export, or return a framework-specific type, and this
 * fails rather than the port failing months later.
 */
import { assertType, describe, it } from "vitest";

import type { NavigationAdapter, NavigationRouter } from "./types";

import * as adapter from "./next";

describe("the Next.js adapter", () => {
  it("satisfies the framework-agnostic contract", () => {
    assertType<NavigationAdapter>(adapter);
  });

  it("returns a router with only the methods the contract names", () => {
    assertType<NavigationRouter>(adapter.useRouter());
  });

  it("takes a plain string for the history mode, not a framework enum", () => {
    assertType<Promise<void>>(adapter.redirect("/settings", "replace"));
  });
});
