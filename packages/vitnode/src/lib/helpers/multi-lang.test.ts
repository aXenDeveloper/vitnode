import { describe, expect, it } from "vitest";

import {
  getLangValue,
  getMultiLangConstraints,
  multiLangValueSchema,
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
