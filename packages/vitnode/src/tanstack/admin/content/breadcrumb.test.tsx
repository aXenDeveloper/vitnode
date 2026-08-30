import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContentAdminBreadcrumbContent } from "./breadcrumb";

/**
 * The trail above a content screen that does not exist.
 *
 * One property, and it is the one that broke the AdminCP's 404 outright: the
 * shell renders a route's `staticData.breadcrumb` for every **matched** route,
 * and a match whose loader answered `notFound()` is still a match. The host
 * spreads `Route.useLoaderData()` into this component, so on that path it is
 * handed nothing at all - and reading a label off nothing threw during the
 * server render, replacing the 404 page with a blank one for every URL a 404 is
 * for: an unresolvable content path, a record that was deleted, a content type
 * this administrator may not open.
 *
 * Rendered rather than called, and with no providers: the guard runs before
 * `RouteMessages`, the router and the navigation are reached, so empty markup is
 * proof that none of them were needed. A regression would not fail this
 * assertion quietly - it would throw here exactly as it did in production.
 */
describe("the Content Engine breadcrumb", () => {
  it("renders nothing when the loader did not resolve", () => {
    const { container } = render(<ContentAdminBreadcrumbContent />);

    expect(container.innerHTML).toBe("");
  });

  /**
   * The specific shape the crash came in: with `action` absent the component's
   * ternary fell through to the *form* crumb, which is the branch that reads a
   * label. Absent props and an absent action are the same case, and both must
   * stop before it.
   */
  it("renders nothing when only the link component is supplied", () => {
    const { container } = render(
      <ContentAdminBreadcrumbContent LinkComponent={undefined} />,
    );

    expect(container.innerHTML).toBe("");
  });
});
