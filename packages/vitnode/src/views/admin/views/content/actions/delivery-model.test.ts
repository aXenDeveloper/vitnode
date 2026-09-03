// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { AnyContentTypeDefinition } from "@/content/types";

import {
  testDeliveredLocalizedContentType,
  testDeliveredPostContentType,
  testLocalizedArticleContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import {
  contentDeliveryRequestLocale,
  hasContentDelivery,
} from "./delivery-model";

const as = (definition: unknown): AnyContentTypeDefinition =>
  definition as AnyContentTypeDefinition;

describe("whether the panel exists at all", () => {
  it("offers it for a content type with a delivery layer", () => {
    expect(hasContentDelivery(as(testDeliveredPostContentType))).toBe(true);
  });

  it("withholds it for one without", () => {
    expect(hasContentDelivery(as(testPostContentType))).toBe(false);
    expect(hasContentDelivery(as(testLocalizedArticleContentType))).toBe(false);
  });

  it("never offers it without a public projection to serve", () => {
    // `resolveContentDelivery` refuses `delivery` without `publicApi`, so the
    // two can never disagree - asserted rather than assumed, because a panel
    // that showed a canonical path with nothing behind it would be a lie.
    for (const definition of [
      testDeliveredPostContentType,
      testDeliveredLocalizedContentType,
    ]) {
      expect(as(definition).publicApi.enabled).toBe(true);
    }
  });
});

describe("which locale a delivery read is for", () => {
  it("asks about the translation the administrator is reading", () => {
    expect(
      contentDeliveryRequestLocale(as(testDeliveredLocalizedContentType), "pl"),
    ).toBe("pl");
  });

  it("asks about no language at all for a content type with one address", () => {
    // Not the administrator's interface language: a record with no translations
    // has exactly one canonical path, and sending a locale would key one cache
    // entry per AdminCP language for identical answers.
    expect(
      contentDeliveryRequestLocale(as(testDeliveredPostContentType), "pl"),
    ).toBeUndefined();
  });

  it("passes an absent language through unchanged", () => {
    expect(
      contentDeliveryRequestLocale(
        as(testDeliveredLocalizedContentType),
        undefined,
      ),
    ).toBeUndefined();
    expect(
      contentDeliveryRequestLocale(as(testDeliveredPostContentType), undefined),
    ).toBeUndefined();
  });

  it("is decided by the content type and never by the string it is handed", () => {
    const localized = as(testDeliveredLocalizedContentType);
    const flat = as(testDeliveredPostContentType);

    for (const locale of ["en", "pl", "de"]) {
      expect(contentDeliveryRequestLocale(localized, locale)).toBe(locale);
      expect(contentDeliveryRequestLocale(flat, locale)).toBeUndefined();
    }
  });
});
