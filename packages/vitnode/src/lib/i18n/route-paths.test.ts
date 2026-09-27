import { describe, expect, it } from "vitest";

import type { LocaleRoutePaths } from "./types";

import { compileRoutePaths, LocaleRoutingConfigError } from "./route-paths";

const RESERVED = ["/admin", "/api"];

const compile = (
  routePaths: LocaleRoutePaths,
  localePrefix: "always" | "as-needed" | "never" = "as-needed",
) =>
  compileRoutePaths({
    isIgnoredPath: pathname =>
      RESERVED.some(
        path => pathname === path || pathname.startsWith(`${path}/`),
      ),
    localePrefix,
    locales: ["en", "pl"],
    routePaths,
  });

const errorOf = (run: () => unknown): LocaleRoutingConfigError => {
  try {
    run();
  } catch (error) {
    if (error instanceof LocaleRoutingConfigError) return error;
    throw error;
  }

  throw new Error("expected a LocaleRoutingConfigError");
};

describe("compileRoutePaths mapping", () => {
  const translator = compile({
    pl: {
      "/articles": "/artykuly",
      "/articles/:id": "/artykuly/:id",
      "/articles/:id/comments/:commentId": "/komentarze/:commentId/artykul/:id",
      "/files/*": "/pliki/*",
    },
  });

  it("maps a public URL to its English route and back, keeping parameter values", () => {
    expect(translator.toInternal("/artykuly/42", "pl")).toBe("/articles/42");
    expect(translator.toPublic("/articles/42", "pl")).toBe("/artykuly/42");
  });

  it("moves parameters by name, not by position", () => {
    expect(translator.toPublic("/articles/42/comments/7", "pl")).toBe(
      "/komentarze/7/artykul/42",
    );
    expect(translator.toInternal("/komentarze/7/artykul/42", "pl")).toBe(
      "/articles/42/comments/7",
    );
  });

  it("falls back to the English path for an untranslated route or locale", () => {
    expect(translator.toPublic("/discover", "pl")).toBe("/discover");
    expect(translator.toPublic("/articles/42", "en")).toBe("/articles/42");
    expect(translator.toInternal("/discover", "pl")).toBe("/discover");
  });

  it("never decodes or re-encodes a parameter value", () => {
    expect(translator.toPublic("/articles/a%2Fb%20c", "pl")).toBe(
      "/artykuly/a%2Fb%20c",
    );
    expect(
      translator.toInternal("/artykuly/za%C5%BC%C3%B3%C5%82%C4%87", "pl"),
    ).toBe("/articles/za%C5%BC%C3%B3%C5%82%C4%87");
  });

  it("keeps one trailing slash where the URL had it", () => {
    expect(translator.toPublic("/articles/42/", "pl")).toBe("/artykuly/42/");
    expect(translator.toInternal("/artykuly/", "pl")).toBe("/articles/");
  });

  it("carries every remaining segment through a catch-all", () => {
    expect(translator.toPublic("/files/a/b/c.txt", "pl")).toBe(
      "/pliki/a/b/c.txt",
    );
    expect(translator.toInternal("/pliki/a/b", "pl")).toBe("/files/a/b");
  });

  it("does not treat a longer or shorter path as the same route", () => {
    expect(translator.toPublic("/articles/42/extra", "pl")).toBe(
      "/articles/42/extra",
    );
    expect(translator.toPublic("/articles-archive", "pl")).toBe(
      "/articles-archive",
    );
  });

  it("encodes non-ASCII static segments and matches them either way", () => {
    const polish = compile({ pl: { "/articles/:id": "/artykuły/:id" } });

    expect(polish.toPublic("/articles/1", "pl")).toBe("/artyku%C5%82y/1");
    expect(polish.toInternal("/artyku%C5%82y/1", "pl")).toBe("/articles/1");
  });

  it("prefers a static translation over a parameter one", () => {
    const ranked = compile({
      pl: {
        "/articles/:id": "/artykuly/:id",
        "/articles/new": "/artykuly/nowy",
      },
    });

    expect(ranked.toPublic("/articles/new", "pl")).toBe("/artykuly/nowy");
    expect(ranked.toInternal("/artykuly/nowy", "pl")).toBe("/articles/new");
    expect(ranked.toInternal("/artykuly/42", "pl")).toBe("/articles/42");
  });
});

describe("compileRoutePaths ranking", () => {
  it("prefers an exact path over a catch-all that would also match it", () => {
    const translator = compile({
      pl: { "/docs": "/dokumentacja", "/docs/*": "/dokumenty/*" },
    });

    expect(translator.toPublic("/docs", "pl")).toBe("/dokumentacja");
    expect(translator.toPublic("/docs/a/b", "pl")).toBe("/dokumenty/a/b");
    expect(translator.toInternal("/dokumentacja", "pl")).toBe("/docs");
  });
});

describe("compileRoutePaths diagnostics", () => {
  it("names a locale the app does not enable", () => {
    const error = errorOf(() => compile({ de: { "/articles": "/artikel" } }));

    expect(error.code).toBe("unknown-route-locale");
    expect(error.locale).toBe("de");
    expect(error.message).toContain('"de"');
  });

  it.each([
    ["missing", "/articles/:id", "/artykuly", /is missing ":id"/],
    ["added", "/articles", "/artykuly/:id", /adds ":id"/],
    ["renamed", "/articles/:id", "/artykuly/:slug", /renames ":id" to ":slug"/],
    ["dropped splat", "/files/*", "/pliki", /drops the "\*"/],
  ])("rejects a %s parameter", (_, source, translated, message) => {
    const error = errorOf(() => compile({ pl: { [source]: translated } }));

    expect(error.code).toBe("parameter-mismatch");
    expect(error).toMatchObject({
      locale: "pl",
      sourcePath: source,
      translatedPath: translated,
    });
    expect(error.message).toMatch(message);
  });

  it.each([
    ["a duplicated parameter", "/a/:id/:id"],
    ["an optional segment", "/artykuly/:id?"],
    ["a malformed splat", "/pliki/*/x"],
    ["uppercase letters", "/Artykuly/:id"],
    ["a missing leading slash", "artykuly/:id"],
  ])("rejects %s", (_, translated) => {
    const error = errorOf(() =>
      compile({ pl: { "/articles/:id": translated } }),
    );

    expect(error.code).toBe("invalid-route-path");
    expect(error.message).toContain(translated);
  });

  it("rejects two translations matching the same URLs even with different parameter names", () => {
    const error = errorOf(() =>
      compile({
        pl: {
          "/articles/:id": "/wpisy/:id",
          "/posts/:slug": "/wpisy/:slug",
        },
      }),
    );

    expect(error.code).toBe("duplicate-route-path");
    expect(error.conflictsWith).toBe("/articles/:id");
    expect(error.sourcePath).toBe("/posts/:slug");
  });

  it("rejects one English route listed twice", () => {
    const error = errorOf(() =>
      compile({
        pl: { "/articles/:id": "/a/:id", "/articles/:slug": "/b/:slug" },
      }),
    );

    expect(error.code).toBe("duplicate-source-path");
  });

  it.each([
    ["/admin/users", "/panel"],
    ["/discover", "/api/odkrywaj"],
  ])(
    "keeps admin and API paths out of translation (%s -> %s)",
    (source, translated) => {
      expect(
        errorOf(() => compile({ pl: { [source]: translated } })).code,
      ).toBe("reserved-route-path");
    },
  );

  it("refuses to translate the home page", () => {
    expect(errorOf(() => compile({ pl: { "/": "/start" } })).code).toBe(
      "root-route-path",
    );
  });

  it("refuses a first segment that would read as a locale prefix", () => {
    expect(
      errorOf(() => compile({ pl: { "/discover": "/en/odkrywaj" } })).code,
    ).toBe("locale-segment");
    expect(() =>
      compile({ pl: { "/discover": "/en/odkrywaj" } }, "never"),
    ).not.toThrow();
  });
});
