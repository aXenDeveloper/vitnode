import { describe, expect, it } from "vitest";

import {
  fieldFingerprint,
  outdatedTranslationFields,
  translationFreshness,
} from "./translation-freshness";

const values = {
  content: [
    { languageCode: "en", value: "<p>New body</p>" },
    { languageCode: "pl", value: "<p>Stara treść</p>" },
  ],
  excerpt: [
    { languageCode: "en", value: "Short" },
    { languageCode: "pl", value: "Krótko, poprawione ręcznie" },
  ],
  title: [
    { languageCode: "en", value: "Hello" },
    { languageCode: "pl", value: "Cześć" },
  ],
};

const recordFor = (
  field: keyof typeof values,
  sourceText: string,
  targetText: string,
) => ({
  field,
  locale: "pl",
  sourceFingerprint: fieldFingerprint(sourceText, "en"),
  targetFingerprint: fieldFingerprint(targetText, "pl"),
});

describe("translationFreshness", () => {
  it("tells fresh, edited, outdated, untracked and missing apart per field", () => {
    const freshness = translationFreshness({
      fields: ["title", "content", "excerpt", "coverImageAlt"],
      locale: "pl",
      records: [
        recordFor("title", "Hello", "Cześć"),
        recordFor("content", "<p>Old body</p>", "<p>Stara treść</p>"),
        recordFor("excerpt", "Short", "Krótko"),
      ],
      sourceLocale: "en",
      values,
    });

    expect(freshness).toEqual({
      content: "outdated",
      coverImageAlt: "missing",
      excerpt: "edited",
      title: "fresh",
    });
    expect(outdatedTranslationFields(freshness)).toEqual(["content"]);
  });

  it("makes no claim without a record, whatever the timestamps say", () => {
    expect(
      translationFreshness({
        fields: ["title"],
        locale: "pl",
        records: [],
        sourceLocale: "en",
        values,
      }),
    ).toEqual({ title: "untracked" });
  });
});
