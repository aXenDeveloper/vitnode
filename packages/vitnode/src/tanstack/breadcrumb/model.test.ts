import { describe, expect, it } from "vitest";

import type { BreadcrumbMatch } from "./model";

import { breadcrumbOf } from "./model";

/**
 * The one rule that replaces Next.js' `@breadcrumb` parallel route: of every
 * matched route, the deepest declaration wins.
 *
 * Tested over plain objects rather than through a router, because that is what
 * the rule is - a fold over the match list, with `undefined` meaning "did not
 * declare" and `null` meaning "declared nothing". Those two being different is
 * the whole of the behaviour, and both are falsy, so it is exactly the pair a
 * reader would collapse by accident.
 */
const match = (breadcrumb?: React.ReactNode): BreadcrumbMatch => ({
  staticData: breadcrumb === undefined ? {} : { breadcrumb },
});

describe("breadcrumbOf", () => {
  it("renders nothing when no route declared a crumb", () => {
    expect(breadcrumbOf([match(), match()])).toBeNull();
  });

  it("renders nothing for an empty match list", () => {
    expect(breadcrumbOf([])).toBeNull();
  });

  it("takes the declaration of the only route that made one", () => {
    expect(breadcrumbOf([match(), match("settings")])).toBe("settings");
  });

  it("prefers the deepest declaration", () => {
    expect(breadcrumbOf([match("settings"), match("security")])).toBe(
      "security",
    );
  });

  it("inherits an ancestor's crumb through a route that declares none", () => {
    expect(breadcrumbOf([match("settings"), match()])).toBe("settings");
  });

  it("lets a child clear an ancestor's crumb with null", () => {
    // `null` is a declaration, not an absence. This is the only way a route
    // inside a shell can say "no breadcrumb here".
    expect(breadcrumbOf([match("settings"), match(null)])).toBeNull();
  });
});
