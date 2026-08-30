// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { ContentFrontendPluginSource } from "../../lib/plugin";
import type { AnyContentTypeDefinition } from "../types";

import { defineContentType } from "../define";
import { field } from "../fields";
import {
  buildContentFrontendRegistry,
  CONTENT_FRONTEND_REGISTRY_MISSING,
  contentFrontendRegistry,
  hasContentFrontendRegistry,
  setContentFrontendRegistry,
} from "./registry";
import { resolveContentAdminRoute } from "./route";

const define = (
  id: string,
  admin: Partial<Parameters<typeof defineContentType>[0]["admin"]> = {},
): AnyContentTypeDefinition =>
  defineContentType({
    id,
    tableName: id.split(".").join("_"),
    fields: { title: field.text({ required: true }) },
    admin: { ...admin },
  }) as AnyContentTypeDefinition;

const plugin = (
  pluginId: string,
  ...definitions: AnyContentTypeDefinition[]
): ContentFrontendPluginSource => ({
  pluginId,
  contentTypes: definitions.map(definition => ({ definition })),
});

const post = define("blog.post");
const category = define("blog.category");
const article = define("example.article");
/** The case the whole `admin.path` design exists for: URL and id disagree. */
const renamed = define("blog.post", { path: "blog/articles" });

describe("buildContentFrontendRegistry", () => {
  it("collects every content type from every plugin", () => {
    const registry = buildContentFrontendRegistry([
      plugin("@vitnode/blog", post, category),
      plugin("@vitnode/example", article),
    ]);

    expect(registry.all().map(entry => entry.definition.id)).toEqual([
      "blog.category",
      "blog.post",
      "example.article",
    ]);
  });

  it("keeps the plugin that registered each content type", () => {
    const registry = buildContentFrontendRegistry([
      plugin("@vitnode/blog", post),
      plugin("@vitnode/example", article),
    ]);

    expect(registry.byId("blog.post")?.pluginId).toBe("@vitnode/blog");
    expect(registry.byId("example.article")?.pluginId).toBe("@vitnode/example");
  });

  /**
   * Order in must not affect order out, or two installs with the same plugins
   * listed differently would disagree about what "the first content type" is.
   */
  it("is deterministic whichever order the plugins arrive in", () => {
    const forwards = buildContentFrontendRegistry([
      plugin("@vitnode/blog", post, category),
      plugin("@vitnode/example", article),
    ]);
    const backwards = buildContentFrontendRegistry([
      plugin("@vitnode/example", article),
      plugin("@vitnode/blog", category, post),
    ]);

    expect(forwards.all().map(entry => entry.definition.id)).toEqual(
      backwards.all().map(entry => entry.definition.id),
    );
  });

  it("carries the registration through untouched, overrides included", () => {
    const cell = () => null;
    const component = () => null;
    const layout = () => null;
    const registry = buildContentFrontendRegistry([
      {
        pluginId: "@vitnode/blog",
        contentTypes: [
          {
            definition: post,
            columns: { title: { cell } },
            fields: { title: { component } },
            forms: { layout },
          },
        ],
      },
    ]);

    const entry = registry.byId("blog.post");

    expect(entry?.registration.fields?.title.component).toBe(component);
    expect(entry?.registration.columns?.title.cell).toBe(cell);
    expect(entry?.registration.forms?.layout).toBe(layout);
  });

  it("ignores a plugin that registers no content types", () => {
    const registry = buildContentFrontendRegistry([
      { pluginId: "@vitnode/nav-only" },
      plugin("@vitnode/blog", post),
    ]);

    expect(registry.all()).toHaveLength(1);
  });

  it("is empty for an app with no plugins", () => {
    expect(buildContentFrontendRegistry([]).all()).toEqual([]);
  });

  describe("lookups", () => {
    const registry = buildContentFrontendRegistry([
      plugin("@vitnode/blog", post, category),
    ]);

    it("finds a content type by id", () => {
      expect(registry.byId("blog.post")?.definition).toBe(post);
    });

    it("answers undefined for an id nothing registered", () => {
      expect(registry.byId("blog.nope")).toBeUndefined();
    });

    it("finds a content type by admin path", () => {
      expect(registry.byAdminPath("blog/post")?.definition).toBe(post);
    });

    it("answers undefined for an admin path nothing registered", () => {
      expect(registry.byAdminPath("blog/nope")).toBeUndefined();
    });
  });

  /**
   * `admin.path` and `definition.id` are allowed to disagree, and the resolver
   * is keyed by the path. A registry whose `lookup` reached for the id instead
   * would break exactly the content types that renamed themselves.
   */
  describe("lookup, as the route resolver reads it", () => {
    const registry = buildContentFrontendRegistry([
      plugin("@vitnode/blog", renamed),
    ]);

    it("resolves the renamed path", () => {
      expect(
        resolveContentAdminRoute(["blog", "articles"], registry.lookup),
      ).toEqual({ action: "list", contentTypeId: "blog.post" });
    });

    it("leaves the id-derived path unrouted", () => {
      expect(
        resolveContentAdminRoute(["blog", "post"], registry.lookup),
      ).toBeUndefined();
    });
  });

  /**
   * The same `validateContentTypes` the API side runs, which is what stops the
   * two registrations silently disagreeing. Every message names the plugin, the
   * content type and the reason.
   */
  describe("validation", () => {
    it("rejects two plugins registering one content type id", () => {
      expect(() =>
        buildContentFrontendRegistry([
          plugin("@vitnode/blog", post),
          plugin("@vitnode/example", define("blog.post")),
        ]),
      ).toThrow(
        /Duplicate content type id.*@vitnode\/blog.*@vitnode\/example/s,
      );
    });

    it("rejects two content types claiming one AdminCP path", () => {
      const clash = define("example.article", { path: "blog/post" });

      expect(() =>
        buildContentFrontendRegistry([
          plugin("@vitnode/blog", post),
          plugin("@vitnode/example", clash),
        ]),
      ).toThrow(/AdminCP path "blog\/post" is claimed by both/);
    });

    it("rejects two content types claiming one physical table", () => {
      const clash = defineContentType({
        id: "example.article",
        tableName: "blog_post",
        fields: { title: field.text({ required: true }) },
      }) as AnyContentTypeDefinition;

      expect(() =>
        buildContentFrontendRegistry([
          plugin("@vitnode/blog", post),
          plugin("@vitnode/example", clash),
        ]),
      ).toThrow(/Table "blog_post" is claimed by both/);
    });
  });
});

describe("the injected registry", () => {
  it("names what is missing, and what to do about it", () => {
    expect(CONTENT_FRONTEND_REGISTRY_MISSING).toContain(
      "setContentFrontendRegistry()",
    );
    expect(CONTENT_FRONTEND_REGISTRY_MISSING).toContain(
      "content-registry.gen.ts",
    );
  });

  it("hands back what was registered", () => {
    const registry = buildContentFrontendRegistry([
      plugin("@vitnode/blog", post),
    ]);

    setContentFrontendRegistry(registry);

    expect(hasContentFrontendRegistry()).toBe(true);
    expect(contentFrontendRegistry()).toBe(registry);
  });

  /** A hot reload re-evaluates the module; a build error is a worse answer. */
  it("replaces a previous registration rather than throwing", () => {
    const first = buildContentFrontendRegistry([plugin("@vitnode/blog", post)]);
    const second = buildContentFrontendRegistry([
      plugin("@vitnode/example", article),
    ]);

    setContentFrontendRegistry(first);
    setContentFrontendRegistry(second);

    expect(contentFrontendRegistry()).toBe(second);
  });
});
