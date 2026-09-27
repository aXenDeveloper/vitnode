// @vitest-environment node
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import type { ContentDeliveryPageMetadata } from "./delivery-page";

import {
  contentDeliveryPage,
  contentDeliveryPageHead,
  contentPageItem,
} from "./delivery-page";

const metadata = (
  overrides: Partial<ContentDeliveryPageMetadata> = {},
): ContentDeliveryPageMetadata => ({
  alternates: [
    { internalPath: "/blog/hello-world", locale: "en" },
    { internalPath: "/blog/witaj-swiecie", locale: "pl" },
  ],
  canonicalInternalPath: "/blog/witaj-swiecie",
  locale: "pl",
  robots: null,
  seo: { description: "<p>Pierwszy wpis.</p>", title: "Witaj świecie" },
  ...overrides,
});

const thrownBy = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }

  throw new Error("Expected the resolution to throw.");
};

describe("contentDeliveryPage", () => {
  const post = { title: "Witaj świecie" };

  it("hands a found item and its metadata to the page", () => {
    const found = { ...metadata(), itemId: 7, type: "content" as const };

    expect(
      contentDeliveryPage({ item: post, resolution: found }),
    ).toStrictEqual({ item: post, metadata: found });
  });

  it("follows a retired slug with a permanent redirect to the public location", () => {
    const error = thrownBy(() =>
      contentDeliveryPage({
        item: null,
        resolution: {
          location: "/pl/wpisy/witaj-swiecie",
          status: 308,
          type: "redirect",
        },
      }),
    );

    expect(isRedirect(error)).toBe(true);
    expect(error).toMatchObject({
      options: { href: "/pl/wpisy/witaj-swiecie", statusCode: 308 },
    });
  });

  it("answers an unknown slug with the route's not-found screen", () => {
    const error = thrownBy(() =>
      contentDeliveryPage({ item: null, resolution: { type: "not_found" } }),
    );

    expect(isNotFound(error)).toBe(true);
  });

  it("answers not-found when the item vanished between the two reads", () => {
    const error = thrownBy(() =>
      contentDeliveryPage({
        item: null,
        resolution: { ...metadata(), type: "content" },
      }),
    );

    expect(isNotFound(error)).toBe(true);
  });
});

describe("contentPageItem", () => {
  it("passes an item through and answers not-found for a missing one", () => {
    expect(contentPageItem({ id: 1 })).toStrictEqual({ id: 1 });
    expect(isNotFound(thrownBy(() => contentPageItem(null)))).toBe(true);
  });
});

describe("contentDeliveryPageHead", () => {
  it("declares alternates as internal paths keyed by locale", () => {
    expect(contentDeliveryPageHead(metadata())).toStrictEqual({
      alternates: {
        en: "/blog/hello-world",
        pl: "/blog/witaj-swiecie",
      },
      description: "Pierwszy wpis.",
      title: "Witaj świecie",
    });
  });

  it("lists only the languages the metadata published for a fallback item", () => {
    const head = contentDeliveryPageHead(
      metadata({
        alternates: [{ internalPath: "/blog/hello-world", locale: "en" }],
        canonicalInternalPath: "/blog/hello-world",
        locale: "en",
      }),
    );

    expect(head.alternates).toStrictEqual({ en: "/blog/hello-world" });
  });

  it("keeps a noindex decision and trims a long description", () => {
    const head = contentDeliveryPageHead(
      metadata({
        robots: { follow: true, index: false },
        seo: { description: `<p>${"słowo ".repeat(60)}</p>`, title: null },
      }),
      { title: "Blog" },
    );

    expect(head.robots).toBe("noindex, nofollow");
    expect(head.title).toBe("Blog");
    expect(head.description?.length).toBeLessThanOrEqual(160);
    expect(head.description?.endsWith("…")).toBe(true);
  });

  it("leaves the alternates of a single-language type to the host", () => {
    expect(
      contentDeliveryPageHead(
        metadata({
          alternates: [],
          canonicalInternalPath: "/articles/hello",
          locale: null,
          seo: { description: null, title: "Hello" },
        }),
      ),
    ).toStrictEqual({ title: "Hello" });
  });
});
