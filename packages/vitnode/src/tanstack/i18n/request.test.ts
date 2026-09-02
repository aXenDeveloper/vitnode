import { describe, expect, it } from "vitest";

import { createLocaleRouting } from "@/lib/i18n/locale-routing";

import { handleLocaleRequest } from "./request";

const localeRouting = createLocaleRouting({
  defaultLocale: "en",
  locales: ["en", "pl"],
});

const planFor = (path: string) =>
  handleLocaleRequest(
    new Request(`https://site.example${path}`),
    localeRouting,
  );

/** Where a browser would actually end up following the plan's redirect. */
const destinationOf = (path: string): string | undefined => {
  const location = planFor(path).redirect?.headers.get("location");
  if (location === null || location === undefined) return undefined;

  return new URL(location, "https://site.example").href;
};

describe("handleLocaleRequest", () => {
  it("canonicalises the default locale away", () => {
    expect(destinationOf("/en/discover")).toBe("https://site.example/discover");
  });

  it("keeps the query string and hash", () => {
    expect(destinationOf("/en/discover?a=1#top")).toBe(
      "https://site.example/discover?a=1#top",
    );
  });

  it("strips a locale prefix from an ignored path", () => {
    expect(destinationOf("/pl/admin")).toBe("https://site.example/admin");
  });

  it("leaves a correctly-spelled URL alone", () => {
    expect(planFor("/discover").redirect).toBeUndefined();
  });

  describe("never redirects off this origin", () => {
    // `//evil.example` in a `Location` header is not a path - it is a
    // protocol-relative URL, and everything after the two slashes is read as a
    // host. Stripping the `/en` off `/en//evil.example` produced exactly that,
    // so the site answered a request for one of its own URLs with a permanent
    // redirect to somebody else's: a phishing link hosted on the real domain.
    it.each([
      "/en//evil.example",
      "/en//evil.example/path",
      "/en///evil.example",
      "/en/\\/evil.example",
      "/en/\\\\evil.example",
    ])("%s stays here", path => {
      const destination = destinationOf(path);

      if (destination === undefined) return;

      expect(new URL(destination).origin).toBe("https://site.example");
    });

    it("keeps the path it was redirecting to", () => {
      expect(destinationOf("/en//evil.example/path")).toBe(
        "https://site.example/evil.example/path",
      );
    });
  });
});
