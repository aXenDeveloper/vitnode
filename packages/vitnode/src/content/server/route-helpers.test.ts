import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";

import type { testLocalizedArticleContentType } from "@/tests/content-fixtures";

import type { ContentTranslationRow } from "../types";

import { identifier, plainOutcome, readJson } from "./route-helpers";

const contextWith = ({
  body,
  params = {},
}: {
  body?: unknown;
  params?: Record<string, string>;
} = {}) =>
  ({
    req: {
      json: async () => Promise.resolve(body),
      param: (name: string) => params[name],
    },
  }) as unknown as Context;

const refusal = (call: () => unknown): HTTPException => {
  try {
    call();
  } catch (error) {
    if (error instanceof HTTPException) return error;
    throw error;
  }

  throw new Error("Expected an HTTPException.");
};

describe("identifier", () => {
  it("reads a positive integer out of the path", () => {
    expect(identifier(contextWith({ params: { id: "42" } }))).toBe(42);
  });

  it("accepts exponent notation, as `Number` has always read it", () => {
    expect(identifier(contextWith({ params: { id: "1e3" } }))).toBe(1000);
  });

  it.each(["0", "-1", "1.5", "abc", "", " ", "Infinity", "NaN"])(
    "refuses %o with the same 400",
    value => {
      const error = refusal(() =>
        identifier(contextWith({ params: { id: value } })),
      );

      expect(error.status).toBe(400);
      expect(error.message).toBe("Invalid identifier.");
    },
  );

  it("refuses a missing parameter", () => {
    const error = refusal(() => identifier(contextWith()));

    expect(error.status).toBe(400);
    expect(error.message).toBe("Invalid identifier.");
  });
});

describe("readJson", () => {
  const schema = z.object({ title: z.string() });

  it("returns the payload the schema accepted", async () => {
    await expect(
      readJson(contextWith({ body: { extra: 1, title: "Hello" } }), schema),
    ).resolves.toEqual({ title: "Hello" });
  });

  it("raises the schema's own rejection for a bad payload", async () => {
    await expect(
      readJson(contextWith({ body: { title: 5 } }), schema),
    ).rejects.toThrow(z.ZodError);
  });
});

/** A real localized content type, so the outcome's generics are exercised. */
type Article = typeof testLocalizedArticleContentType;
type ArticleTranslation = ContentTranslationRow<Article>;

describe("plainOutcome", () => {
  const row: ArticleTranslation = {
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    itemId: 7,
    languageId: 2,
    locale: "pl",
    updatedAt: new Date("2026-09-02T00:00:00.000Z"),
    values: { body: null, slug: "witaj", title: "Witaj" },
    version: 3,
  };

  it("carries the row's identity and version through", () => {
    expect(plainOutcome<Article>("create", row)).toEqual({
      changed: true,
      changedFields: [],
      languageId: 2,
      locale: "pl",
      operation: "create",
      previousSlug: null,
      restoredFromRevisionId: null,
      revisionId: null,
      row,
      version: 3,
    });
  });

  it("has no revision, because there is no history to write", () => {
    // The whole point of the plain path: a localized content type without
    // `editorial` still emits its events, and carries no revision id.
    expect(plainOutcome<Article>("update", row).revisionId).toBeNull();
    expect(
      plainOutcome<Article>("update", row).restoredFromRevisionId,
    ).toBeNull();
  });

  it("reports a no-op when the caller says nothing moved", () => {
    expect(
      plainOutcome<Article>("update", row, { changed: false }),
    ).toMatchObject({
      changed: false,
      changedFields: [],
    });
  });
});
