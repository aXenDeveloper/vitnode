import { describe, expect, it } from "vitest";

import type { OgImageTemplate } from "./types";

import {
  OgImagesConfigError,
  OgImageTemplateNotFoundError,
  resolveOgImagesConfig,
  selectOgImageTemplate,
} from "./config";
import { defaultOgImageTemplateEntry } from "./default-template";

const METADATA = { title: "VitNode Community" };

const template = (version = "1"): OgImageTemplate => ({
  render: defaultOgImageTemplateEntry.render,
  version,
});

describe("resolveOgImagesConfig", () => {
  it("is null without an `ogImages` block, which keeps the routes off", () => {
    expect(resolveOgImagesConfig(undefined, METADATA)).toBeNull();
  });

  it("registers the built-in template as the default when `templates` is omitted", () => {
    const config = resolveOgImagesConfig({}, METADATA);

    expect(config?.defaultTemplate).toBe("default");
    expect([...(config?.templates ?? new Map())]).toStrictEqual([
      ["default", defaultOgImageTemplateEntry],
    ]);
  });

  it.each([
    ["an invalid template id", { templates: { "Bad Id": template() } }],
    ["a template without a version", { templates: { blog: template("") } }],
    [
      "a defaultTemplate that is not registered",
      { defaultTemplate: "missing", templates: { blog: template() } },
    ],
  ])("throws OgImagesConfigError for %s", (_case, config) => {
    expect(() => resolveOgImagesConfig(config, METADATA)).toThrow(
      OgImagesConfigError,
    );
  });
});

describe("selectOgImageTemplate", () => {
  const blog = template("3");
  const config = resolveOgImagesConfig(
    {
      defaultTemplate: "blog",
      templates: { blog, docs: template() },
    },
    METADATA,
  );
  if (!config) throw new Error("Expected a resolved config.");

  it.each([null, undefined])(
    "picks the configured default when the request names %s",
    requested => {
      expect(selectOgImageTemplate(config, requested)).toStrictEqual({
        id: "blog",
        template: blog,
      });
    },
  );

  it("picks the requested template when it is registered", () => {
    expect(selectOgImageTemplate(config, "docs").id).toBe("docs");
  });

  it("throws rather than falling back for an unregistered template", () => {
    expect(() => selectOgImageTemplate(config, "missing")).toThrow(
      OgImageTemplateNotFoundError,
    );
  });
});
