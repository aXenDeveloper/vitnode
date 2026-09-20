// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { BlockPluginSource } from "./types";

import { field } from "../content/fields";
import { defineBlock } from "./define";
import { BlockError, BlockRegistryMissingError } from "./errors";
import {
  allowedBlocks,
  createBlockRegistry,
  getDefaultBlockRegistry,
  isBlockAllowed,
  resolveBlockRegistry,
  setDefaultBlockRegistry,
} from "./registry";

const Noop = () => null;

const block = (id: string) =>
  defineBlock({
    component: Noop,
    fields: { title: field.text({ required: true }) },
    id,
  });

const source = (
  pluginId: string,
  ids: string[],
  namespace?: string,
): BlockPluginSource => ({
  pluginId,
  blocks: ids.map(block),
  ...(namespace === undefined ? {} : { namespace }),
});

describe("createBlockRegistry", () => {
  it("namespaces every block by the last segment of its plugin id", () => {
    const registry = createBlockRegistry([
      source("@vitnode/core", ["hero"]),
      source("@vitnode/blog", ["latest-posts"]),
    ]);

    expect(registry.get("core:hero")?.definition.id).toBe("hero");
    expect(registry.get("blog:latest-posts")?.pluginId).toBe("@vitnode/blog");
  });

  it("honours an explicit namespace over the derived one", () => {
    const registry = createBlockRegistry([
      source("@acme/page-builder", ["hero"], "acme"),
    ]);

    expect(registry.has("acme:hero")).toBe(true);
    expect(registry.has("page-builder:hero")).toBe(false);
  });

  it("refuses two plugins whose ids derive the same namespace", () => {
    expect(() =>
      createBlockRegistry([
        source("@vitnode/blog", ["latest-posts"]),
        source("@acme/blog", ["featured"]),
      ]),
    ).toThrow(/claimed by both/);
  });

  it("refuses the same block id twice inside one plugin", () => {
    expect(() =>
      createBlockRegistry([source("@vitnode/blog", ["hero", "hero"])]),
    ).toThrow(BlockError);
  });

  it("keeps one namespace when a plugin registers in two passes", () => {
    const registry = createBlockRegistry([
      source("@vitnode/blog", ["hero"]),
      source("@vitnode/blog", ["latest-posts"]),
    ]);

    expect(registry.namespaces()).toStrictEqual(["blog"]);
    expect(registry.all().map(entry => entry.type)).toStrictEqual([
      "blog:hero",
      "blog:latest-posts",
    ]);
  });

  it("answers an unregistered id with undefined rather than throwing", () => {
    const registry = createBlockRegistry([source("@vitnode/core", ["hero"])]);

    expect(registry.get("blog:latest-posts")).toBeUndefined();
    expect(registry.has("blog:latest-posts")).toBe(false);
  });

  it("lists a namespace's blocks", () => {
    const registry = createBlockRegistry([
      source("@vitnode/core", ["hero", "cta"]),
      source("@vitnode/blog", ["latest-posts"]),
    ]);

    expect(registry.byNamespace("core").map(entry => entry.type)).toStrictEqual(
      ["core:hero", "core:cta"],
    );
  });

  it("sorts `all` by id, whatever the registration order", () => {
    const registry = createBlockRegistry([
      source("@vitnode/example", ["zeta", "alpha"]),
    ]);

    expect(registry.all().map(entry => entry.type)).toStrictEqual([
      "example:alpha",
      "example:zeta",
    ]);
  });
});

describe("isBlockAllowed", () => {
  it('accepts everything under "*"', () => {
    expect(isBlockAllowed("*", "blog:latest-posts")).toBe(true);
  });

  it("accepts an exact id and refuses its neighbours", () => {
    expect(isBlockAllowed(["core:hero"], "core:hero")).toBe(true);
    expect(isBlockAllowed(["core:hero"], "core:cta")).toBe(false);
  });

  it("accepts a namespace wildcard", () => {
    expect(isBlockAllowed(["blog:*"], "blog:latest-posts")).toBe(true);
    expect(isBlockAllowed(["blog:*"], "core:hero")).toBe(false);
  });

  it("refuses a type that is not a block id", () => {
    expect(isBlockAllowed("*", "hero")).toBe(false);
  });
});

describe("allowedBlocks", () => {
  it("resolves a spec against the registry", () => {
    const registry = createBlockRegistry([
      source("@vitnode/core", ["hero", "cta"]),
      source("@vitnode/blog", ["latest-posts"]),
    ]);

    expect(
      allowedBlocks(registry, ["core:*", "blog:latest-posts"]).map(
        entry => entry.type,
      ),
    ).toStrictEqual(["blog:latest-posts", "core:cta", "core:hero"]);
  });
});

describe("namespace collisions", () => {
  it("refuses one plugin claiming two namespaces", () => {
    expect(() =>
      createBlockRegistry([
        source("@vitnode/blog", ["hero"]),
        source("@vitnode/blog", ["cta"], "articles"),
      ]),
    ).toThrow(/One plugin owns one namespace/);
  });

  it("names both plugins when two derive the same namespace", () => {
    expect(() =>
      createBlockRegistry([
        source("@vitnode/blog", ["hero"]),
        source("@acme/blog", ["hero"]),
      ]),
    ).toThrow(/"@vitnode\/blog".*"@acme\/blog"/);
  });

  it("lets an explicit namespace settle a derived collision", () => {
    const registry = createBlockRegistry([
      source("@vitnode/blog", ["hero"]),
      source("@acme/blog", ["hero"], "acme-blog"),
    ]);

    expect(registry.namespaces()).toStrictEqual(["acme-blog", "blog"]);
  });

  it("refuses a plugin claiming the namespace core reserved", () => {
    expect(() =>
      createBlockRegistry([
        source("@vitnode/core", ["hero"], "core"),
        source("@acme/core", ["hero"]),
      ]),
    ).toThrow(/claimed by both/);
  });

  it("derives a namespace from the plugin id alone, never from where it is installed", () => {
    const one = createBlockRegistry([source("@vitnode/blog", ["hero"])]);
    const two = createBlockRegistry([source("@vitnode/blog", ["hero"])]);

    expect(one.all().map(entry => entry.type)).toStrictEqual(
      two.all().map(entry => entry.type),
    );
  });
});

describe("registry isolation", () => {
  it("keeps two registries from seeing each other's blocks", () => {
    const core = createBlockRegistry([source("@vitnode/core", ["hero"])]);
    const blog = createBlockRegistry([source("@vitnode/blog", ["hero"])]);

    expect(core.has("core:hero")).toBe(true);
    expect(core.has("blog:hero")).toBe(false);
    expect(blog.has("core:hero")).toBe(false);
    expect(blog.has("blog:hero")).toBe(true);
  });

  it("does not mutate a registry when another is built afterwards", () => {
    const core = createBlockRegistry([source("@vitnode/core", ["hero"])]);
    const before = core.all().map(entry => entry.type);

    createBlockRegistry([source("@vitnode/blog", ["hero", "cta"])]);

    expect(core.all().map(entry => entry.type)).toStrictEqual(before);
  });
});

describe("the process default", () => {
  it("is unset until something installs one", () => {
    expect(getDefaultBlockRegistry()).toBeUndefined();
    expect(() => resolveBlockRegistry()).toThrow(BlockRegistryMissingError);
  });

  it("is restored by the function that installed it", () => {
    const registry = createBlockRegistry([source("@vitnode/core", ["hero"])]);
    const restore = setDefaultBlockRegistry(registry);

    expect(getDefaultBlockRegistry()).toBe(registry);

    restore();

    expect(getDefaultBlockRegistry()).toBeUndefined();
  });

  it("nests, so one application installing a registry cannot strand another", () => {
    const outer = createBlockRegistry([source("@vitnode/core", ["hero"])]);
    const inner = createBlockRegistry([source("@vitnode/blog", ["hero"])]);

    const restoreOuter = setDefaultBlockRegistry(outer);
    const restoreInner = setDefaultBlockRegistry(inner);

    expect(getDefaultBlockRegistry()).toBe(inner);

    restoreInner();
    expect(getDefaultBlockRegistry()).toBe(outer);

    restoreOuter();
    expect(getDefaultBlockRegistry()).toBeUndefined();
  });

  it("is ignored whenever a registry is passed explicitly", () => {
    const installed = createBlockRegistry([source("@vitnode/core", ["hero"])]);
    const explicit = createBlockRegistry([source("@vitnode/blog", ["hero"])]);
    const restore = setDefaultBlockRegistry(installed);

    try {
      expect(resolveBlockRegistry(explicit)).toBe(explicit);
    } finally {
      restore();
    }
  });
});
