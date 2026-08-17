// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// `server-only` throws on import outside a server component, which is exactly its
// job - and exactly what a unit test has to stub, the same way the revalidation
// tests do.
vi.mock("server-only", () => ({}));

import type { ContentDeliveryResponse } from "./delivery.server";

import { contentDeliveryToNextMetadata } from "./delivery.server";

/**
 * The Next.js metadata mapping, without a network.
 *
 * `contentDeliveryToNextMetadata` is the whole of the adapter's judgement: which
 * delivery fields become which `Metadata` keys, and what an absent value does. Every
 * assertion below is about a key being **absent** rather than present-and-null,
 * because Next renders a `null` title as an empty `<title>` and an absent one not at
 * all - and an empty `<title>` is worse than none.
 */

const response = (
  overrides: Partial<ContentDeliveryResponse> = {},
): ContentDeliveryResponse => ({
  alternates: [],
  canonicalPath: "/articles/hello",
  hreflang: { languages: {} },
  isFallback: false,
  itemId: 42,
  locale: null,
  openGraph: null,
  requestedLocale: null,
  robots: null,
  seo: { description: "A summary.", title: "Hello" },
  ...overrides,
});

describe("contentDeliveryToNextMetadata", () => {
  it("maps the canonical path relative when no origin is given", () => {
    expect(contentDeliveryToNextMetadata(response())).toStrictEqual({
      alternates: { canonical: "/articles/hello" },
      description: "A summary.",
      title: "Hello",
    });
  });

  it("makes every URL absolute when an origin is given", () => {
    const metadata = contentDeliveryToNextMetadata(
      response({
        hreflang: {
          languages: { en: "/en/articles/hello", pl: "/pl/articles/witaj" },
          xDefault: "/en/articles/hello",
        },
      }),
      { origin: "https://example.com" },
    );

    expect(metadata.alternates).toStrictEqual({
      canonical: "https://example.com/articles/hello",
      languages: {
        en: "https://example.com/en/articles/hello",
        pl: "https://example.com/pl/articles/witaj",
        // `x-default` is the standard's own key, so it lives in the same map.
        "x-default": "https://example.com/en/articles/hello",
      },
    });
  });

  it("omits a title rather than emitting an empty one", () => {
    const metadata = contentDeliveryToNextMetadata(
      response({ seo: { description: null, title: null } }),
    );

    expect(metadata).not.toHaveProperty("title");
    expect(metadata).not.toHaveProperty("description");
  });

  it("omits alternates entirely when there is nothing to say", () => {
    const metadata = contentDeliveryToNextMetadata(
      response({ canonicalPath: null }),
    );

    expect(metadata).not.toHaveProperty("alternates");
  });

  it("emits no Open Graph block when the content type configured none", () => {
    expect(contentDeliveryToNextMetadata(response())).not.toHaveProperty(
      "openGraph",
    );
  });

  it("carries the canonical URL into the Open Graph block", () => {
    const metadata = contentDeliveryToNextMetadata(
      response({
        openGraph: { description: "Social summary", title: "Social" },
      }),
      { origin: "https://example.com" },
    );

    expect(metadata.openGraph).toStrictEqual({
      description: "Social summary",
      title: "Social",
      url: "https://example.com/articles/hello",
    });
  });

  it("passes the robots directive through untouched", () => {
    expect(
      contentDeliveryToNextMetadata(
        response({ robots: { follow: true, index: false } }),
      ).robots,
    ).toStrictEqual({ follow: true, index: false });
  });

  it("drops an alternate whose path will not resolve against the origin", () => {
    const metadata = contentDeliveryToNextMetadata(
      response({ hreflang: { languages: { en: "http://", pl: "/pl/x" } } }),
      { origin: "https://example.com" },
    );

    expect(metadata.alternates?.languages).toStrictEqual({
      pl: "https://example.com/pl/x",
    });
  });
});
