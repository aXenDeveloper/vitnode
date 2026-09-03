import { isValidElement } from "react";
import { describe, expect, it } from "vitest";

import type { BreadcrumbMatch, RouteBreadcrumbProps } from "./model";

import { breadcrumbGroup, breadcrumbTrail } from "./model";

/**
 * The rule that replaces Next.js' `@breadcrumb` parallel route: every matched
 * route that declares a crumb contributes one, parent to child.
 *
 * Tested over plain objects rather than through a router, because that is what
 * the rule is - a fold over the match list. What each shape *means* is the whole
 * of the behaviour: a component is instantiated with its own match's data, an
 * element is taken as it is, and `false`, `null` and a missing declaration all
 * contribute nothing while leaving their parents' crumbs alone.
 */
/**
 * A trail's labels.
 *
 * Cast rather than read straight off `content`, because React 19 types
 * `ReactNode` as including a promise - so an arrow returning one reads as an
 * async function to every lint rule that looks for one, and one of those rules
 * helpfully adds the `async` keyword.
 */
const labelsOf = (matches: readonly BreadcrumbMatch[]): string[] =>
  breadcrumbTrail(matches).map(entry => entry.content as string);

const match = (
  breadcrumb: BreadcrumbMatch["staticData"]["breadcrumb"],
  rest: Partial<BreadcrumbMatch> = {},
): BreadcrumbMatch => ({
  pathname: "/",
  ...rest,
  staticData: breadcrumb === undefined ? {} : { breadcrumb },
});

describe("breadcrumbTrail", () => {
  it("is empty when no route declared a crumb", () => {
    expect(breadcrumbTrail([match(undefined), match(undefined)])).toEqual([]);
  });

  it("is empty for an empty match list", () => {
    expect(breadcrumbTrail([])).toEqual([]);
  });

  it("collects every declaration, parent to child", () => {
    const matches = [
      match("Home", { pathname: "/", routeId: "root" }),
      match("Catalog", { pathname: "/catalog", routeId: "catalog" }),
      match("Products", {
        pathname: "/catalog/products",
        routeId: "products",
      }),
    ];
    const trail = breadcrumbTrail(matches);

    expect(labelsOf(matches)).toEqual(["Home", "Catalog", "Products"]);

    expect(trail.map(entry => entry.key)).toEqual([
      "root",
      "catalog",
      "products",
    ]);
    expect(trail.map(entry => entry.href)).toEqual([
      "/",
      "/catalog",
      "/catalog/products",
    ]);
  });

  it("marks only the last crumb as the current page", () => {
    const trail = breadcrumbTrail([match("Catalog"), match("Products")]);

    expect(trail.map(entry => entry.isCurrent)).toEqual([false, true]);
  });

  it("keeps a parent's crumb when a child declares none", () => {
    expect(labelsOf([match("Catalog"), match(undefined)])).toEqual(["Catalog"]);
  });

  it.each([false, null])("omits a route that declared %s", declared => {
    expect(labelsOf([match("Catalog"), match(declared)])).toEqual(["Catalog"]);
  });

  it("still marks the deepest *contributing* route as current", () => {
    const trail = breadcrumbTrail([
      match("Catalog"),
      match("Products"),
      match(false),
    ]);

    expect(trail.at(-1)).toMatchObject({
      content: "Products",
      isCurrent: true,
    });
  });

  it("keys a match with no route id by its position", () => {
    expect(breadcrumbTrail([match("Catalog")])[0].key).toBe("match-0");
  });

  it("hands a component its own match's data", () => {
    const seen: RouteBreadcrumbProps[] = [];
    const Crumb = (props: RouteBreadcrumbProps) => {
      seen.push(props);

      return null;
    };

    const [entry] = breadcrumbTrail([
      match(Crumb, {
        loaderData: { name: "Laptops" },
        params: { categorySlug: "laptops" },
        pathname: "/catalog/laptops",
        search: { page: 2 },
      }),
    ]);

    expect(isValidElement(entry.content)).toBe(true);
    expect((entry.content as React.ReactElement).type).toBe(Crumb);
    expect((entry.content as React.ReactElement).props).toEqual({
      loaderData: { name: "Laptops" },
      params: { categorySlug: "laptops" },
      pathname: "/catalog/laptops",
      search: { page: 2 },
    });
    // Declared, not rendered: the shell decides when a crumb runs.
    expect(seen).toEqual([]);
  });

  it("gives a component empty params when the match has none", () => {
    const Crumb = () => null;
    const [entry] = breadcrumbTrail([match(Crumb)]);

    expect((entry.content as React.ReactElement).props).toMatchObject({
      params: {},
    });
  });

  it("marks a group so the shell lets it render its own items", () => {
    const Crumbs = () => null;
    const [entry] = breadcrumbTrail([
      match(breadcrumbGroup(Crumbs), { pathname: "/admin/core/users" }),
    ]);

    expect(entry.spansItems).toBe(true);
    expect((entry.content as React.ReactElement).type).toBe(Crumbs);
  });

  it("does not mistake a label for a group", () => {
    const Crumb = () => null;

    expect(breadcrumbTrail([match(Crumb)])[0].spansItems).toBe(false);
    expect(breadcrumbTrail([match("Catalog")])[0].spansItems).toBe(false);
  });
});
