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

  it("reads rich text documents, telling an empty one from a translated one", () => {
    const paragraph = (text: string) => ({
      content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
      type: "doc",
    });
    const richValues = {
      body: [
        { languageCode: "en", value: paragraph("New body") },
        { languageCode: "pl", value: paragraph("Stara treść") },
      ],
      summary: [
        { languageCode: "en", value: paragraph("Short") },
        {
          languageCode: "pl",
          value: { content: [{ type: "paragraph" }], type: "doc" },
        },
      ],
    };

    expect(
      translationFreshness({
        fields: ["body", "summary"],
        locale: "pl",
        records: [
          {
            field: "body",
            locale: "pl",
            sourceFingerprint: fieldFingerprint(
              [{ languageCode: "en", value: paragraph("Old body") }],
              "en",
            ),
            targetFingerprint: fieldFingerprint(richValues.body, "pl"),
          },
        ],
        sourceLocale: "en",
        values: richValues,
      }),
    ).toEqual({ body: "outdated", summary: "missing" });
  });
});
