// @vitest-environment node
import {
  contentDeliveryInternalPath,
  contentDeliveryPublicUrl,
  contentPublicHref,
  contentSearchUrl,
} from "@vitnode/core/content";
import { createLocaleRouting } from "@vitnode/core/lib/i18n/locale-routing";
import { describe, expect, it } from "vitest";

import { blogPostContentType } from "./post";

const ROUTE_PATHS = { pl: { "/blog/:slug": "/wpisy/:slug" } };

const prefixed = createLocaleRouting({
  defaultLocale: "en",
  locales: ["en", "pl"],
  routePaths: ROUTE_PATHS,
});

const withDomains = createLocaleRouting({
  defaultLocale: "en",
  domains: [
    { defaultLocale: "en", origin: "https://vitnode.com" },
    { defaultLocale: "pl", origin: "https://vitnode.pl" },
  ],
  locales: ["en", "pl"],
  routePaths: ROUTE_PATHS,
});

const SLUGS = { en: "hello-world", pl: "witaj-swiecie" } as const;

const deliveryHref = (
  routing: typeof prefixed,
  locale: keyof typeof SLUGS,
): null | string => {
  const url = contentDeliveryPublicUrl({
    definition: blogPostContentType,
    locale,
    routing,
    slug: SLUGS[locale],
  });

  return url === null ? null : contentPublicHref(url);
};

describe("Blog article URLs", () => {
  it("serves every article from the /blog/:slug page", () => {
    expect(
      contentDeliveryInternalPath({
        definition: blogPostContentType,
        slug: SLUGS.pl,
      }),
    ).toBe("/blog/witaj-swiecie");
  });

  it("translates the Polish path and keeps English unprefixed", () => {
    expect(deliveryHref(prefixed, "en")).toBe("/blog/hello-world");
    expect(deliveryHref(prefixed, "pl")).toBe("/pl/wpisy/witaj-swiecie");
  });

  it("links search results to the same URL as delivery", () => {
    for (const locale of ["en", "pl"] as const) {
      expect(
        contentSearchUrl({
          definition: blogPostContentType,
          locale,
          routing: prefixed,
          slug: SLUGS[locale],
        }),
      ).toBe(deliveryHref(prefixed, locale));
    }
  });

  it("puts each language on its own domain", () => {
    expect(deliveryHref(withDomains, "pl")).toBe(
      "https://vitnode.pl/wpisy/witaj-swiecie",
    );
    expect(
      contentSearchUrl({
        definition: blogPostContentType,
        locale: "pl",
        routing: withDomains,
        slug: SLUGS.pl,
      }),
    ).toBe("https://vitnode.pl/wpisy/witaj-swiecie");
  });
});
