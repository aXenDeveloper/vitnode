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

  it("propagates an error that carries no status at all", async () => {
    const error = new Error("500 - http://localhost/api/...");

    await expect(load(error)).rejects.toBe(error);
  });
});
