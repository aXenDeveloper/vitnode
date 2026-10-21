import { describe, expect, it } from "vitest";

import type { OgImagesConfig, OgImageTemplate } from "./types";

import {
  listOgImageTemplates,
  OgImageConfigError,
  resolveOgImagesConfig,
  selectOgImageTemplate,
} from "./config";
import { defaultOgImageTemplate } from "./default-template";

const template = (version: string): OgImageTemplate => ({
  render: defaultOgImageTemplate.render,
  version,
});

const article = template("1");
const spotlight = template("3");

const resolve = (config: OgImagesConfig) => {
  const resolved = resolveOgImagesConfig(config);
  if (!resolved) throw new Error("Expected a resolved config.");

  return resolved;
};

describe("resolveOgImagesConfig", () => {
  it("leaves generated images off when the block is not set", () => {
    expect(resolveOgImagesConfig(undefined)).toBeNull();
  });

  it("always registers the built-in template as the default", () => {
    const config = resolve({});

    expect(config.defaultTemplate).toBe("default");
    expect(config.templates.get("default")).toBe(defaultOgImageTemplate);
  });

  it.each([
    ["an id with capitals", { templates: { Article: article } }],
    ["an id that is too long", { templates: { ["a".repeat(65)]: article } }],
    [
      "a template without render",
      { templates: { article: { version: "1" } as OgImageTemplate } },
    ],
    [
      "a template with an empty version",
      { templates: { article: template("") } },
    ],
    ["an unregistered default", { defaultTemplate: "missing" }],
  ])("refuses %s", (_label, config) => {
    expect(() => resolveOgImagesConfig(config)).toThrow(OgImageConfigError);
  });

  it("keeps the config version stable for the same input", () => {
    expect(resolve({ version: "1" }).configVersion).toBe(
      resolve({ version: "1" }).configVersion,
    );
  });

  it.each<[string, OgImagesConfig]>([
    ["version", { version: "2" }],
    ["site name", { branding: { siteName: "Other" } }],
    ["colors", { branding: { colors: { accent: "#000000" } } }],
    ["logo", { branding: { logo: "data:image/png;base64,AA==" } }],
    ["fonts", { fonts: [{ data: new Uint8Array(), name: "Inter" }] }],
    [
      "font weight",
      { fonts: [{ data: new Uint8Array(), name: "Inter", weight: 700 }] },
    ],
  ])("changes the config version with the %s", (_label, changed) => {
    const base = resolve({
      fonts: [{ data: new Uint8Array(), name: "Base" }],
    }).configVersion;

    expect(
      resolve({
        fonts: [{ data: new Uint8Array(), name: "Base" }],
        ...changed,
      }).configVersion,
    ).not.toBe(base);
  });

  it("ignores template versions, which every image key carries itself", () => {
    expect(resolve({ templates: { article } }).configVersion).toBe(
      resolve({ templates: { article: spotlight } }).configVersion,
    );
  });
});

describe("selectOgImageTemplate", () => {
  const config = resolve({
    defaultTemplate: "article",
    templates: { article, spotlight },
  });

  it.each([
    ["missing", undefined],
    ["null", null],
  ])("uses the configured default when the id is %s", (_label, id) => {
    expect(selectOgImageTemplate(config, id)).toStrictEqual({
      id: "article",
      template: article,
    });
  });

  it("uses the named template when it is registered", () => {
    expect(selectOgImageTemplate(config, "spotlight")).toStrictEqual({
      id: "spotlight",
      template: spotlight,
    });
  });

  it("falls back to the default for an unknown id", () => {
    expect(selectOgImageTemplate(config, "removed")?.id).toBe("article");
  });

  it("answers null for an unknown id when strict", () => {
    expect(
      selectOgImageTemplate(config, "removed", { strict: true }),
    ).toBeNull();
    expect(
      selectOgImageTemplate(config, "spotlight", { strict: true })?.id,
    ).toBe("spotlight");
  });
});

describe("listOgImageTemplates", () => {
  it("lists the default first, then the rest by id, without functions", () => {
    expect(
      listOgImageTemplates(
        resolve({
          defaultTemplate: "spotlight",
          templates: { spotlight, article },
        }),
      ),
    ).toStrictEqual([
      { id: "spotlight", isDefault: true, version: "3" },
      { id: "article", isDefault: false, version: "1" },
      {
        id: "default",
        isDefault: false,
        version: defaultOgImageTemplate.version,
      },
    ]);
  });
});
