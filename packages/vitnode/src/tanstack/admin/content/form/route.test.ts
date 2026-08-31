// @vitest-environment node
import { isNotFound } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import type { AnyContentTypeDefinition } from "@/content/types";

import { buildContentFrontendRegistry } from "@/content/admin/registry";
import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";
import { AdminRequestError } from "@/views/admin/admin-request";

import type { AdminScreenContext } from "../../screen";
import type { ContentAdminRouteData } from "../route";

import { loadContentFormScreen } from "./route";

/**
 * What a page-mode form loader does with a read it could not complete.
 *
 * The distinction the whole suite is about, because the two answers look the
 * same from inside the loader and mean opposite things to the person waiting:
 *
 *     /admin/content/blog/articles/999999/edit   no such record   404
 *     the API is down, rate-limiting, or wrong   an outage        error
 *
 * `ContentEditPageView`, the Next.js screen this replaced, answers `notFound()`
 * for *every* non-200 - so an unreachable API showed an administrator "not
 * found" for a record that exists. Preserving the route's semantics means
 * keeping the 404 for the case that really is one and not the rest, which is
 * why every assertion here is about a status code rather than about failing.
 *
 * A stub `QueryClient` and a stub registry: the loader's decision is made
 * entirely from what `ensureQueryData` settles to, so a rejecting stub is the
 * whole of the unit rather than a stand-in for one.
 */

const definition = defineContentType({
  id: "blog.post",
  tableName: "blog_post",
  fields: { title: field.text({ required: true }) },
  admin: {
    path: "blog/articles",
    create: { mode: "page" },
    edit: { mode: "page" },
  },
}) as AnyContentTypeDefinition;

const registry = buildContentFrontendRegistry([
  { pluginId: "@vitnode/blog", contentTypes: [{ definition }] },
]);

/**
 * A root administrator - the permission checks are not what is under test.
 *
 * `status: "granted"` is what `adminPermissionsOf` reads; anything else empties
 * the permission set and `requireAdminPermission` answers `notFound()` before
 * the read this suite is about ever happens, which would make every assertion
 * below pass for the wrong reason.
 */
const adminAccess = {
  session: { permissions: { permissions: [], root: true } },
  status: "granted",
} as unknown as AdminScreenContext["adminAccess"];

const editRoute: ContentAdminRouteData = {
  action: "edit",
  adminPath: "blog/articles",
  contentTypeId: "blog.post",
  description: undefined,
  itemId: 999999,
  labels: {} as ContentAdminRouteData["labels"],
  namespaces: [],
  pluginId: "@vitnode/blog",
  title: "Articles",
};

/**
 * A `QueryClient` that only has to answer one method.
 *
 * `ensureQueryData` is the single call the loader makes, and the loader never
 * reads the client for anything else, so the cast is narrower than it looks.
 */
const clientRejecting = (error: Error): AdminScreenContext["queryClient"] =>
  ({
    ensureQueryData: async () => await Promise.reject(error),
  }) as unknown as AdminScreenContext["queryClient"];

const load = async (error: Error) =>
  await loadContentFormScreen({
    adminAccess,
    locale: "en",
    queryClient: clientRejecting(error),
    registry,
    route: editRoute,
  });

describe("a record that is not there", () => {
  it("is the AdminCP's not-found, not an error screen", async () => {
    // The whole point: a stale link to a deleted article lands on the panel's
    // own 404, inside the shell, exactly as the Next.js view did.
    await expect(
      load(new AdminRequestError(404, "blog.post #999999")),
    ).rejects.toSatisfy(isNotFound);
  });

  /**
   * A refusal from the API is the *authorization* answer, and it can arrive on
   * a screen the route guard already admitted: the guard decides on a cached
   * permission set, and a permission revoked mid-session is only visible here.
   * `requireAdminPermission` answers that with `notFound()` too, so both
   * readings of "you may not open this" produce one screen.
   */
  it("treats a refusal the same way", async () => {
    await expect(
      load(new AdminRequestError(403, "blog.post #999999")),
    ).rejects.toSatisfy(isNotFound);
  });
});

describe("a read that failed", () => {
  it.each([
    [429, "the rate limiter"],
    [502, "a gateway that is not answering"],
  ])("propagates %i (%s) rather than dressing it as a 404", async status => {
    const error = new AdminRequestError(status, "blog.post #999999");

    await expect(load(error)).rejects.toBe(error);
    await expect(load(error)).rejects.not.toSatisfy(isNotFound);
  });

  /**
   * `rawApiFetch` throws a plain `Error` for a 500 before an
   * `AdminRequestError` is ever built, and a schema mismatch between the
   * installed plugin and the running API arrives as one too. Neither carries a
   * status, and neither is a missing record.
   */
  it("propagates an error that carries no status at all", async () => {
    const error = new Error("500 - http://localhost/api/...");

    await expect(load(error)).rejects.toBe(error);
  });
});
