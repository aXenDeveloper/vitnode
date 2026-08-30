// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { ContentRouteLabels } from "@/views/admin/views/content/content-labels";

import {
  CONTENT_ADMIN_CREATE_SEGMENT,
  CONTENT_ADMIN_EDIT_SEGMENT,
} from "@/content/index";

import type { ContentBreadcrumbModel } from "./breadcrumb-model";
import type { ContentAdminRouteData } from "./route";

import {
  CONTENT_BREADCRUMB_NONE,
  contentBreadcrumbListHref,
  contentBreadcrumbModel,
} from "./breadcrumb-model";

/**
 * The trail above a content screen, including the one above a screen that does
 * not exist.
 *
 * A pure test, in a node environment, with no React and no DOM. What is being
 * checked is a decision - which segments, which labelled href, or nothing at
 * all - and that decision is a function now, so rendering it to assert on empty
 * markup would only add a jsdom to the question.
 *
 * ## The regression this exists for
 *
 * The shell renders a route's `staticData.breadcrumb` for every **matched**
 * route, and a match whose loader answered `notFound()` is still a match. The
 * host spreads `Route.useLoaderData()` into the breadcrumb, so on that path it
 * is handed nothing at all - and reading a label off nothing threw during the
 * server render, replacing the AdminCP's 404 with a blank page for exactly the
 * URLs a 404 is for: an unresolvable content path, a record that was deleted, a
 * content type this administrator may not open.
 */

const labels: ContentRouteLabels = {
  desc: "Everything published",
  plural: "Articles",
  singular: "Article",
  title: "Articles",
};

/**
 * The trail's segments, with the empty model spelled as the empty list.
 *
 * A narrowing helper rather than a cast: `kind: "none"` genuinely has no
 * segments, and reading them off the union without saying what happens then is
 * the same omission the component used to make.
 */
const segmentsOf = (model: ContentBreadcrumbModel): string[] =>
  model.kind === "none" ? [] : model.segments;

const route = (
  overrides: Partial<ContentAdminRouteData> = {},
): Parameters<typeof contentBreadcrumbModel>[0] => ({
  action: "list",
  adminPath: "blog/articles",
  labels,
  ...overrides,
});

describe("a loader that did not resolve", () => {
  it("has no trail when it is handed nothing at all", () => {
    // The exact call the host makes on a `notFound()` route: `{...undefined}`
    // spreads to no props, so the function is called with nothing.
    expect(contentBreadcrumbModel()).toEqual(CONTENT_BREADCRUMB_NONE);
    expect(contentBreadcrumbModel({})).toEqual(CONTENT_BREADCRUMB_NONE);
  });

  /**
   * The specific shape the crash came in. With `action` absent the component's
   * ternary fell through to the *form* branch, which is the branch that reads a
   * label - so an absent action has to be "not resolved" rather than "not a
   * list".
   */
  it("has no trail when the action is missing", () => {
    expect(contentBreadcrumbModel(route({ action: undefined }))).toEqual(
      CONTENT_BREADCRUMB_NONE,
    );
  });

  it.each([
    ["the path", { adminPath: undefined }],
    ["the labels", { labels: undefined }],
  ])("has no trail when %s is missing", (_name, missing) => {
    expect(contentBreadcrumbModel(route(missing))).toEqual(
      CONTENT_BREADCRUMB_NONE,
    );
  });

  it("says so explicitly rather than with an empty segment list", () => {
    // `none` and "a trail whose crumbs all resolved to nothing" are different
    // answers, and the shell has to be able to tell them apart.
    const model = contentBreadcrumbModel();

    expect(model.kind).toBe("none");
    expect(model).not.toHaveProperty("segments");
  });
});

describe("a list URL", () => {
  it("is the content namespace plus the content type's own path", () => {
    expect(contentBreadcrumbModel(route())).toEqual({
      kind: "list",
      segments: ["content", "blog", "articles"],
      title: "Articles",
    });
  });

  /**
   * `admin.path` is arbitrary and need not spell the content type id, so the
   * trail is split from the path rather than derived from anything else.
   */
  it("follows an arbitrary admin.path, however deep", () => {
    expect(
      segmentsOf(
        contentBreadcrumbModel(route({ adminPath: "docs/guides/pages" })),
      ),
    ).toEqual(["content", "docs", "guides", "pages"]);
  });

  /** The sidebar already labels this href; the heading may still differ. */
  it("carries the title without a label map", () => {
    expect(contentBreadcrumbModel(route())).not.toHaveProperty("listHref");
  });
});

describe("a create URL", () => {
  const model = contentBreadcrumbModel(route({ action: "create" }));

  it("ends at the create segment", () => {
    expect(model).toEqual({
      action: "create",
      kind: "form",
      listHref: "/admin/content/blog/articles",
      segments: ["content", "blog", "articles", CONTENT_ADMIN_CREATE_SEGMENT],
      singular: "Article",
      title: "Articles",
    });
  });

  /**
   * The trail passes *through* the list, which the navigation can label - but
   * only if it is told which href that is, because the last segment is a page
   * the navigation does not know about.
   */
  it("names the list href it has to label", () => {
    expect(model).toMatchObject({
      listHref: contentBreadcrumbListHref("blog/articles"),
      title: "Articles",
    });
  });
});

describe("an edit URL", () => {
  it("ends at the edit segment and names the singular", () => {
    expect(contentBreadcrumbModel(route({ action: "edit" }))).toEqual({
      action: "edit",
      kind: "form",
      listHref: "/admin/content/blog/articles",
      segments: ["content", "blog", "articles", CONTENT_ADMIN_EDIT_SEGMENT],
      singular: "Article",
      title: "Articles",
    });
  });

  /**
   * The record id is deliberately not a crumb. `/admin/content/blog/articles/7/edit`
   * trails as `Content / Articles / Edit article` - a number in the middle names
   * nothing a reader could click or recognise.
   */
  it("does not put the record id in the trail", () => {
    expect(
      segmentsOf(contentBreadcrumbModel(route({ action: "edit", itemId: 42 }))),
    ).not.toContain("42");
  });
});

describe("the list href helper", () => {
  it("is the AdminCP content path", () => {
    expect(contentBreadcrumbListHref("blog/articles")).toBe(
      "/admin/content/blog/articles",
    );
  });
});
