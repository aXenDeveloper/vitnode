// @vitest-environment node
import { describe, expect, it } from "vitest";

import { testLocalizedGuideContentType } from "@/tests/content-fixtures";

import { contentItemTitle } from "./item-query";

const translation = (locale: string, title: string) => ({
  itemId: 7,
  languageId: locale === "en" ? 1 : 2,
  locale,
  values: { title },
  version: 1,
});

const titleIn = (
  locale: string,
  translations: ReturnType<typeof translation>[],
) =>
  contentItemTitle({
    definition: testLocalizedGuideContentType,
    locale,
    row: { id: 7 },
    translations,
  });

describe("contentItemTitle", () => {
  it("names the record in the reader's language", () => {
    expect(
      titleIn("pl", [translation("en", "Hello"), translation("pl", "Witaj")]),
    ).toBe("Witaj");
  });

  it("falls back to the default language when the reader's is empty", () => {
    expect(
      titleIn("pl", [translation("en", "Hello"), translation("pl", " ")]),
    ).toBe("Hello");
  });

  it("falls back to any language with a title", () => {
    expect(titleIn("en", [translation("pl", "Witaj")])).toBe("Witaj");
  });

  it("falls back to the id when no language has a title", () => {
    expect(titleIn("pl", [])).toBe("#7");
  });
});
