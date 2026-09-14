import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { describe, expectTypeOf, it } from "vitest";

import type { VitNodeApiPlugin } from "./config.api";

import { blogApiPlugin } from "./config.api";

describe("the blog API plugin keeps its literal shape", () => {
  it("retains the plugin id and both registered modules", () => {
    const plugin = blogApiPlugin();

    expectTypeOf(plugin.pluginId).toEqualTypeOf<"@vitnode/blog">();
    expectTypeOf(plugin.modules.length).toEqualTypeOf<2>();
    expectTypeOf(plugin.modules[0].name).toEqualTypeOf<"admin">();
    expectTypeOf(plugin.modules[1].name).toEqualTypeOf<"content">();
  });
});

describe("the contract reduces that plugin to its API surface", () => {
  it("keeps the literal plugin id", () => {
    expectTypeOf<
      VitNodeApiPlugin["pluginId"]
    >().toEqualTypeOf<"@vitnode/blog">();
  });

  it("lists the module paths a call may name", () => {
    // `admin/content` and its per-content-type children are absent on purpose:
    // `buildContentAdminModule` names them from a runtime string, so they carry
    // no literal type and admitting them would widen `module` to `string`.
    expectTypeOf<VitNodeApiPlugin["modulePaths"]>().toEqualTypeOf<
      "admin" | "content" | "content/blog"
    >();
  });

  it("carries no runtime member of the plugin", () => {
    expectTypeOf<keyof VitNodeApiPlugin>().toEqualTypeOf<
      "endpoints" | "modulePaths" | "modules" | "pluginId"
    >();
  });
});

describe("the universal fetcher reaches the blog's public content routes", () => {
  it("lists posts through the generated content module", async () => {
    const response = await fetcher({
      plugin: "@vitnode/blog",
      args: { query: { first: "10" } },
      method: "get",
      module: "content/blog",
      path: "/",
    });

    expectTypeOf(response.status).toEqualTypeOf<200 | 400>();

    if (response.status === 200) {
      expectTypeOf(
        (await response.json()).pageInfo.hasNextPage,
      ).toEqualTypeOf<boolean>();
    }
  });

  it("reads one post by its slug", async () => {
    const response = await fetcher({
      plugin: "@vitnode/blog",
      args: { params: { slug: "hello-world" } },
      method: "get",
      module: "content/blog",
      path: "/{slug}",
    });

    expectTypeOf(response.status).toEqualTypeOf<200 | 404>();
  });

  it("offers no public module for a content type without a public API", async () => {
    await fetcher({
      plugin: "@vitnode/blog",
      method: "get",
      // @ts-expect-error -- categories declare no `publicApi`
      module: "content/categories",
      path: "/",
    });
  });

  it("rejects a slug read that omits its parameter", async () => {
    // @ts-expect-error -- `/{slug}` declares params
    await fetcher({
      plugin: "@vitnode/blog",
      method: "get",
      module: "content/blog",
      path: "/{slug}",
    });
  });

  it("rejects a write on the read-only public API", async () => {
    await fetcher({
      plugin: "@vitnode/blog",
      // @ts-expect-error -- the public list is a `get`
      method: "post",
      module: "content/blog",
      path: "/",
    });
  });

  it("rejects the cookie relay, which only a server can honour", async () => {
    await fetcher({
      plugin: "@vitnode/blog",
      // @ts-expect-error -- `allowSaveCookies` is on `tanstack/fetcher/server`
      allowSaveCookies: true,
      args: { query: { first: "10" } },
      method: "get",
      module: "content/blog",
      path: "/",
    });
  });
});
