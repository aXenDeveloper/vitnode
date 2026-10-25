import { describe, expect, it } from "vitest";

import type { ResolvedOgImagesConfig } from "../../og-image/server/config";
import type { ContentDeliveryOgImageSource } from "../delivery";
import type { ContentFileDescriptor } from "../files";

import { resolveOgImagesConfig } from "../../og-image/server/config";
import { defaultOgImageTemplateEntry } from "../../og-image/server/default-template";
import { defineContentType } from "../define";
import { ContentEngineError } from "../errors";
import { field } from "../fields";
import {
  assertContentOgImageTemplates,
  contentOgImageVersion,
} from "./og-image";

const METADATA = { title: "VitNode Community" };

const resolved = (
  config: Parameters<typeof resolveOgImagesConfig>[0],
): ResolvedOgImagesConfig => {
  const result = resolveOgImagesConfig(config, METADATA);
  if (!result) throw new Error("Expected a resolved config.");

  return result;
};

const CONFIG = resolved({});

const postsWithTemplate = (template: string) =>
  defineContentType({
    id: "og.post",
    delivery: {
      seo: {
        openGraph: { image: { template }, titleField: "title" },
        titleField: "title",
      },
    },
    fields: {
      slug: field.slug({ source: "title" }),
      title: field.text({ required: true }),
    },
    publication: true,
    publicApi: { fields: ["id", "title", "slug"], path: "posts" },
    tableName: "og_posts",
  });

describe("assertContentOgImageTemplates", () => {
  it("accepts a content type naming a registered template", () => {
    expect(() =>
      assertContentOgImageTemplates(
        [{ definition: postsWithTemplate("default"), pluginId: "@acme/blog" }],
        CONFIG,
      ),
    ).not.toThrow();
  });

  it("refuses a content type naming a template ogImages does not register", () => {
    expect(() =>
      assertContentOgImageTemplates(
        [{ definition: postsWithTemplate("missing"), pluginId: "@acme/blog" }],
        CONFIG,
      ),
    ).toThrow(ContentEngineError);
  });
});

describe("contentOgImageVersion", () => {
  const file = (id: number, url: string): ContentFileDescriptor => ({
    id,
    mimeType: "image/png",
    name: "cover.png",
    size: 1,
    url,
  });

  const SOURCE: ContentDeliveryOgImageSource = {
    alt: "Cover",
    cover: file(1, "/uploads/cover.png"),
    description: "Prose",
    template: null,
    title: "Hello world",
  };

  const version = (
    source: ContentDeliveryOgImageSource = SOURCE,
    locale: null | string = "en",
    config: ResolvedOgImagesConfig = CONFIG,
  ) => contentOgImageVersion({ config, locale, source });

  it("is stable while nothing drawn on the card changes", () => {
    expect(version()).toBe(version({ ...SOURCE }));
  });

  it.each<[string, () => string]>([
    ["title", () => version({ ...SOURCE, title: "Goodbye" })],
    ["description", () => version({ ...SOURCE, description: "Other" })],
    ["alt text", () => version({ ...SOURCE, alt: "Other" })],
    [
      "cover file",
      () => version({ ...SOURCE, cover: file(2, "/uploads/other.png") }),
    ],
    ["locale", () => version(SOURCE, "pl")],
    [
      "template version",
      () =>
        version(
          SOURCE,
          "en",
          resolved({
            templates: {
              default: { ...defaultOgImageTemplateEntry, version: "next" },
            },
          }),
        ),
    ],
    [
      "install branding",
      () =>
        version(SOURCE, "en", resolved({ branding: { siteName: "Renamed" } })),
    ],
  ])("changes with the %s", (_change, changed) => {
    expect(changed()).not.toBe(version());
  });
});
