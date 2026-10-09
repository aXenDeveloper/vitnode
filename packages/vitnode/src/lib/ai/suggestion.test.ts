import { describe, expect, it } from "vitest";

import {
  applyAiSuggestion,
  buildAiFieldInput,
  suggestionFreshness,
} from "./suggestion";

const values = {
  content: [
    { languageCode: "en", value: "<p>Body</p>" },
    { languageCode: "pl", value: "<p>Treść</p>" },
  ],
  title: [
    { languageCode: "en", value: "Hello" },
    { languageCode: "pl", value: "Cześć" },
  ],
};

describe("buildAiFieldInput", () => {
  it("reads every source field in the edited language", () => {
    const { input } = buildAiFieldInput({
      language: "pl",
      sourceFields: ["title", "content"],
      values,
    });

    expect(input).toEqual({
      content: "<p>Treść</p>",
      locale: "pl",
      title: "Cześć",
    });
  });

  it("changes its fingerprint when a source changes", () => {
    const before = buildAiFieldInput({
      language: "en",
      sourceFields: ["title"],
      values,
    });
    const after = buildAiFieldInput({
      language: "en",
      sourceFields: ["title"],
      values: { ...values, title: [{ languageCode: "en", value: "Hi" }] },
    });

    expect(before.sourceFingerprint).not.toBe(after.sourceFingerprint);
  });
});

describe("suggestion freshness", () => {
  const suggestion = {
    language: "en",
    runId: 1,
    sourceFingerprint: "abc",
    targetSnapshot: "old excerpt",
    text: "New excerpt",
  };

  it("flags changed sources and a newer edit of the field", () => {
    expect(
      suggestionFreshness({
        currentSourceFingerprint: "abc",
        currentTarget: "old excerpt",
        suggestion,
      }),
    ).toEqual({ staleSource: false, targetEdited: false });
    expect(
      suggestionFreshness({
        currentSourceFingerprint: "xyz",
        currentTarget: "typed meanwhile",
        suggestion,
      }),
    ).toEqual({ staleSource: true, targetEdited: true });
  });
});

describe("applyAiSuggestion", () => {
  it("replaces only the edited language", () => {
    expect(
      applyAiSuggestion({
        language: "pl",
        multiLang: true,
        text: "Nowy",
        value: values.title,
      }),
    ).toEqual([
      { languageCode: "en", value: "Hello" },
      { languageCode: "pl", value: "Nowy" },
    ]);
    expect(
      applyAiSuggestion({
        language: "en",
        multiLang: false,
        text: "x",
        value: "y",
      }),
    ).toBe("x");
  });
});
