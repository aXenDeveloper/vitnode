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

const translated = createLocaleRouting({
  defaultLocale: "en",
  locales: ["en", "pl"],
  routePaths: { pl: { "/articles/:id": "/artykuly/:id" } },
});

const onDomains = createLocaleRouting({
  defaultLocale: "en",
  domains: [
    { defaultLocale: "en", origin: "https://vitnode.com" },
    { defaultLocale: "pl", origin: "https://vitnode.pl" },
  ],
  locales: ["en", "pl"],
  routePaths: { pl: { "/articles/:id": "/artykuly/:id" } },
});

const request = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { headers });

describe("handleLocaleRequest with translated route paths", () => {
  it("sends an old English spelling to the translated one, query and hash intact", () => {
    const plan = handleLocaleRequest(
      request("https://site.example/pl/articles/42?page=2#comments"),
      translated,
    );

    expect(plan.redirect?.status).toBe(308);
    expect(plan.redirect?.headers.get("location")).toBe(
      "/pl/artykuly/42?page=2#comments",
    );
  });

  it("does not redirect the canonical URL again", () => {
    const plan = handleLocaleRequest(
      request("https://site.example/pl/artykuly/42?page=2"),
      translated,
    );

    expect(plan.redirect).toBeUndefined();
  });

  it("still records a locale chosen by its prefix", () => {
    const plan = handleLocaleRequest(
      request("https://site.example/pl/artykuly/42"),
      translated,
    );

    expect(plan.setCookie).toMatch(/^vitnode_locale=pl/);
  });

  it("keeps the prefix under localePrefix always", () => {
    const always = createLocaleRouting({
      defaultLocale: "en",
      localePrefix: "always",
      locales: ["en", "pl"],
      routePaths: { pl: { "/articles/:id": "/artykuly/:id" } },
    });

    expect(
      handleLocaleRequest(
        request("https://site.example/articles/1"),
        always,
      ).redirect?.headers.get("location"),
    ).toBe("/en/articles/1");
    expect(
      handleLocaleRequest(request("https://site.example/en/articles/1"), always)
        .redirect,
    ).toBeUndefined();
  });

  it.each([
    "https://site.example/admin/articles/42",
    "https://site.example/api/articles/42",
    "https://site.example/api",
  ])("leaves %s alone", url => {
    expect(handleLocaleRequest(request(url), translated)).toEqual({});
    expect(
      handleLocaleRequest(
        request(url, { cookie: "vitnode_locale=pl", host: "vitnode.pl" }),
        onDomains,
      ),
    ).toEqual({});
  });
});

describe("handleLocaleRequest on language domains", () => {
  it("sends a locale that lives on another domain to that origin", () => {
    const plan = handleLocaleRequest(
      request("https://vitnode.com/pl/articles/42?page=2#top", {
        host: "vitnode.com",
      }),
      onDomains,
    );

    expect(plan.redirect?.headers.get("location")).toBe(
      "https://vitnode.pl/artykuly/42?page=2#top",
    );
    expect(plan.redirect?.headers.get("set-cookie")).toBeNull();
  });

  it("reads the public host from x-forwarded-host", () => {
    const plan = handleLocaleRequest(
      request("http://127.0.0.1:3000/articles/42", {
        host: "127.0.0.1:3000",
        "x-forwarded-host": "vitnode.pl",
      }),
      onDomains,
    );

    expect(plan.redirect?.headers.get("location")).toBe("/artykuly/42");
  });

  it("serves the domain's language whatever the cookie says", () => {
    const plan = handleLocaleRequest(
      request("https://vitnode.pl/artykuly/42", {
        cookie: "vitnode_locale=en",
        host: "vitnode.pl",
      }),
      onDomains,
    );

    expect(plan).toEqual({});
    expect(
      onDomains.resolveLocale("/artykuly/42", {
        cookieLocale: "en",
        host: "vitnode.pl",
      }),
    ).toBe("pl");
  });

  it("does not redirect a canonical domain URL", () => {
    expect(
      handleLocaleRequest(
        request("https://vitnode.pl/artykuly/42", { host: "vitnode.pl" }),
        onDomains,
      ).redirect,
    ).toBeUndefined();
    expect(
      handleLocaleRequest(
        request("https://vitnode.com/articles/42", { host: "vitnode.com" }),
        onDomains,
      ).redirect,
    ).toBeUndefined();
  });

  it("marks a host-dependent redirect as varying by host", () => {
    const plan = handleLocaleRequest(
      request("https://vitnode.com/pl/articles/42", { host: "vitnode.com" }),
      onDomains,
    );

    expect(plan.redirect?.headers.get("vary")).toBe("host, x-forwarded-host");
  });

  it.each([
    ["an unconfigured host", "evil.example"],
    ["a host with a path", "vitnode.pl/evil"],
    ["a host with credentials", "user@vitnode.pl"],
    ["a list led by garbage", "vitnode.pl evil, vitnode.pl"],
  ])("ignores %s", (_label, forwarded) => {
    const plan = handleLocaleRequest(
      request("https://preview.example/pl/articles/42", {
        host: "preview.example",
        "x-forwarded-host": forwarded,
      }),
      onDomains,
    );

    expect(plan.redirect?.headers.get("location")).toBe("/pl/artykuly/42");
  });
});
