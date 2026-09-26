import { describe, expect, it } from "vitest";

import {
  getLangValue,
  getMultiLangConstraints,
  multiLangValueSchema,
  pickLangCode,
  resolveLangValue,
  upsertLangValue,
} from "./multi-lang";

describe("upsertLangValue", () => {
  it("inserts a new language entry when it does not exist", () => {
    expect(upsertLangValue(undefined, "en", "Hello")).toEqual([
      { languageCode: "en", value: "Hello" },
    ]);
    expect(
      upsertLangValue([{ languageCode: "en", value: "Hello" }], "pl", "Cześć"),
    ).toEqual([
      { languageCode: "en", value: "Hello" },
      { languageCode: "pl", value: "Cześć" },
    ]);
  });

  it("updates the existing entry for the language", () => {
    expect(
      upsertLangValue(
        [
          { languageCode: "en", value: "Hello" },
          { languageCode: "pl", value: "Cześć" },
        ],
        "en",
        "Hi",
      ),
    ).toEqual([
      { languageCode: "en", value: "Hi" },
      { languageCode: "pl", value: "Cześć" },
    ]);
  });

  it("does not mutate the input array", () => {
    const value = [{ languageCode: "en", value: "Hello" }];
    upsertLangValue(value, "en", "Hi");
    upsertLangValue(value, "pl", "Cześć");

    expect(value).toEqual([{ languageCode: "en", value: "Hello" }]);
  });
});

describe("getLangValue", () => {
  it("returns the value for the language, empty string otherwise", () => {
    const value = [{ languageCode: "en", value: "Hello" }];

    expect(getLangValue(value, "en")).toBe("Hello");
    expect(getLangValue(value, "pl")).toBe("");
    expect(getLangValue(undefined, "en")).toBe("");
  });
});

describe("pickLangCode", () => {
  const LANGUAGES = ["en", "pl", "de"];

  const pick = (
    value: { languageCode: string; value: string }[],
    options: {
      defaultLanguage?: string;
      isFilled?: (text: string) => boolean;
      locale?: string;
    } = {},
  ) =>
    pickLangCode({
      defaultLanguage: options.defaultLanguage ?? "en",
      isFilled: options.isFilled,
      languageCodes: LANGUAGES,
      locale: options.locale ?? "pl",
      value,
    });

  it("keeps the current language when it has text", () => {
    expect(
      pick([
        { languageCode: "en", value: "Hello" },
        { languageCode: "pl", value: "Cześć" },
      ]),
    ).toBe("pl");
  });

  it("falls back to the default language", () => {
    expect(
      pick([
        { languageCode: "de", value: "Hallo" },
        { languageCode: "en", value: "Hello" },
        { languageCode: "pl", value: "   " },
      ]),
    ).toBe("en");
  });

  it("falls back to any language with text", () => {
    expect(pick([{ languageCode: "de", value: "Hallo" }])).toBe("de");
  });

  it("stays on the current language when every language is empty", () => {
    expect(pick([])).toBe("pl");
    expect(pick([{ languageCode: "en", value: "" }])).toBe("pl");
  });

  it("uses the first language when the current one is not enabled", () => {
    expect(pick([], { locale: "fr" })).toBe("en");
  });

  it("never picks a language that is not enabled", () => {
    expect(pick([{ languageCode: "fr", value: "Bonjour" }])).toBe("pl");
  });

  it("uses the given emptiness check, e.g. for editor HTML", () => {
    expect(
      pick(
        [
          { languageCode: "en", value: "<p>Hello</p>" },
          { languageCode: "pl", value: "<p></p>" },
        ],
        { isFilled: html => html.replace(/<[^>]+>/g, "").trim() !== "" },
      ),
    ).toBe("en");
  });
});

describe("resolveLangValue", () => {
  it("reads the current language, then the default, then any other", () => {
    const value = [
      { languageCode: "de", value: "Hallo" },
      { languageCode: "en", value: "Hello" },
    ];

    expect(
      resolveLangValue(value, { defaultLanguage: "en", locale: "de" }),
    ).toBe("Hallo");
    expect(
      resolveLangValue(value, { defaultLanguage: "en", locale: "pl" }),
    ).toBe("Hello");
    expect(
      resolveLangValue([{ languageCode: "de", value: "Hallo" }], {
        defaultLanguage: "en",
        locale: "pl",
      }),
    ).toBe("Hallo");
    expect(resolveLangValue([], { defaultLanguage: "en", locale: "pl" })).toBe(
      "",
    );
  });
});

describe("multiLangValueSchema", () => {
  it("accepts an array of { languageCode, value }", () => {
    const result = multiLangValueSchema().safeParse([
      { languageCode: "en", value: "Hello" },
    ]);

    expect(result.success).toBe(true);
  });

  it("enforces min/max length on the value", () => {
    const schema = multiLangValueSchema({ minLength: 2, maxLength: 5 });

    expect(schema.safeParse([{ languageCode: "en", value: "a" }]).success).toBe(
      false,
    );
    expect(
      schema.safeParse([{ languageCode: "en", value: "toolong" }]).success,
    ).toBe(false);
    expect(
      schema.safeParse([{ languageCode: "en", value: "ok" }]).success,
    ).toBe(true);
  });
});

describe("getMultiLangConstraints", () => {
  it("reads value min/max length from itemParams", () => {
    expect(
      getMultiLangConstraints({ value: { maxLength: 255, minLength: 1 } }),
    ).toEqual({ maxLength: 255, minLength: 1 });
  });

  it("returns an empty object when there are no constraints", () => {
    expect(getMultiLangConstraints(undefined)).toEqual({});
    expect(getMultiLangConstraints({ value: {} })).toEqual({
      maxLength: undefined,
      minLength: undefined,
    });
  });
});
