// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  testDeliveredLocalizedContentType,
  testDeliveredPostContentType,
  testEditorialPostContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import { contentPreviewUrl } from "./preview-link";

const PLUGIN_ID = "@vitnode/example";
const TOKEN = "eyJhdWQiOiJjb250ZW50LXByZXZpZXcifQ.c2lnbmF0dXJl";

// Deliberately different hosts. Both default to localhost:3000, which would make
// "did this resolve against the web app or the API" unanswerable.
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_WEB_URL", "https://example.com");
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("contentPreviewUrl", () => {
  it("uses the preview page when the content type names one", () => {
    // `testEditorialPostContentType` sets `/editorial/preview/{token}`.
    const url = contentPreviewUrl({
      definition: testEditorialPostContentType,
      pluginId: PLUGIN_ID,
      token: TOKEN,
    });

    expect(url).toBe(
      `https://example.com/editorial/preview/${encodeURIComponent(TOKEN)}`,
    );
  });

  describe("the record's own page", () => {
    it("links at the canonical URL with the token as a query parameter", () => {
      // The point of the whole branch: a reviewer lands on the page the published
      // record uses, not on a JSON body.
      const url = contentPreviewUrl({
        definition: testDeliveredPostContentType,
        pluginId: PLUGIN_ID,
        slug: "my-post",
        token: TOKEN,
      });

      const parsed = new URL(url);
      expect(parsed.origin).toBe("https://example.com");
      expect(parsed.pathname).toBe("/delivered-posts/my-post");
      expect(parsed.searchParams.get("preview")).toBe(TOKEN);
    });

    it("carries the language in the path on a localized content type", () => {
      const url = contentPreviewUrl({
        definition: testDeliveredLocalizedContentType,
        locale: "pl",
        pluginId: PLUGIN_ID,
        slug: "moj-wpis",
        token: TOKEN,
      });

      const parsed = new URL(url);
      expect(parsed.pathname).toBe("/pl/delivered-localized/moj-wpis");
      // No `?locale=`: the path already says which language this is, and the page
      // reads it from its own route parameter.
      expect(parsed.searchParams.get("locale")).toBeNull();
      expect(parsed.searchParams.get("preview")).toBe(TOKEN);
    });

    it("survives a slug that needs encoding", () => {
      const url = contentPreviewUrl({
        definition: testDeliveredPostContentType,
        pluginId: PLUGIN_ID,
        slug: "a b&c",
        token: TOKEN,
      });

      expect(new URL(url).pathname).toBe("/delivered-posts/a%20b%26c");
    });

    it("is skipped without a locale on a localized content type", () => {
      // One URL per language, and no locale-less one. Guessing would hand a
      // reviewer the wrong language under a URL that claims otherwise.
      const url = contentPreviewUrl({
        definition: testDeliveredLocalizedContentType,
        pluginId: PLUGIN_ID,
        slug: "moj-wpis",
        token: TOKEN,
      });

      expect(new URL(url).origin).toBe("https://api.example.com");
    });

    it.each([
      ["no slug", undefined],
      ["a slug that folds to nothing", "   "],
    ])("falls through to the endpoint with %s", (_name, slug) => {
      // A canonical URL that points at a list page is worse than no canonical URL.
      const url = contentPreviewUrl({
        definition: testDeliveredPostContentType,
        pluginId: PLUGIN_ID,
        slug,
        token: TOKEN,
      });

      expect(new URL(url).origin).toBe("https://api.example.com");
    });
  });

  describe("the JSON endpoint", () => {
    it("is the answer for a content type with no page to link at", () => {
      const url = contentPreviewUrl({
        definition: testPostContentType,
        pluginId: PLUGIN_ID,
        token: TOKEN,
      });

      const parsed = new URL(url);
      expect(parsed.origin).toBe("https://api.example.com");
      expect(parsed.pathname).toBe(
        `/api/${PLUGIN_ID}/content/${testPostContentType.publicApi.path}/preview/${encodeURIComponent(TOKEN)}`,
      );
    });

    it("keeps carrying the locale as a query parameter", () => {
      // There is no path segment to put it in here, so the reader is told which
      // language the token was minted for the only way it can be.
      const url = contentPreviewUrl({
        definition: testPostContentType,
        locale: "pl",
        pluginId: PLUGIN_ID,
        token: TOKEN,
      });

      expect(new URL(url).searchParams.get("locale")).toBe("pl");
    });
  });
});
