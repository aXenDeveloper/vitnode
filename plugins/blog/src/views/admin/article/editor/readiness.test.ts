import type { RichTextDocument } from "@vitnode/core/content/rich-text";

import { describe, expect, it } from "vitest";

import {
  articleChecks,
  type ArticleValues,
  fieldText,
  translatedFieldStatus,
} from "./readiness";

const lang = <TValue = string>(entries: Record<string, TValue>) =>
  Object.entries(entries).map(([languageCode, value]) => ({
    languageCode,
    value,
  }));

const doc = (...paragraphs: string[]): RichTextDocument => ({
  content: paragraphs.map(text =>
    text === ""
      ? { type: "paragraph" }
      : { content: [{ text, type: "text" }], type: "paragraph" },
  ),
  type: "doc",
});

const values: ArticleValues = {
  content: lang<null | RichTextDocument>({
    en: doc("Hello world"),
    pl: doc(""),
  }),
  coverImage: 12,
  coverImageAlt: lang({ en: "A dashboard" }),
  excerpt: lang({ en: "Short summary" }),
  friendlyUrl: lang({ en: "hello-world", pl: "witaj-swiecie" }),
  title: lang({
    en: "VitNode 2.0: rebuilding the AdminCP for teams that publish every day",
    pl: "Witaj świecie",
  }),
};

describe("fieldText", () => {
  it("reads the article body as the words of its document", () => {
    expect(
      fieldText(
        {
          content: lang<null | RichTextDocument>({ en: doc("One", "", "Two") }),
        },
        "content",
        "en",
      ),
    ).toBe("One\nTwo");
  });

  it("reads a language with no document as empty", () => {
    expect(
      fieldText(
        { content: lang<null | RichTextDocument>({ pl: null }) },
        "content",
        "pl",
      ),
    ).toBe("");
    expect(fieldText(values, "content", "de")).toBe("");
  });
});

describe("translatedFieldStatus", () => {
  it("treats an editor holding only an empty paragraph as missing", () => {
    expect(
      translatedFieldStatus(values, "content", { source: "en", target: "pl" }),
    ).toBe("missing");
  });

  it("reports a translated field as done", () => {
    expect(
      translatedFieldStatus(values, "title", { source: "en", target: "pl" }),
    ).toBe("done");
  });

  it("has nothing to translate when the source is empty too", () => {
    expect(
      translatedFieldStatus(
        { ...values, excerpt: lang({ en: "" }) },
        "excerpt",
        { source: "en", target: "pl" },
      ),
    ).toBe("unavailable");
  });
});

describe("articleChecks", () => {
  const checks = articleChecks({
    locales: ["en", "pl", "de"],
    outdated: ["pl"],
    source: "en",
    values,
  });
  const check = <Id extends (typeof checks)[number]["id"]>(id: Id) =>
    checks.find(item => item.id === id) as Extract<
      (typeof checks)[number],
      { id: Id }
    >;

  it("flags titles longer than search results show", () => {
    expect(check("title")).toEqual({ id: "title", ok: false, tooLong: ["en"] });
  });

  it("asks for an excerpt and alt text only in started languages", () => {
    expect(check("excerpt").missing).toEqual(["pl"]);
    expect(check("alt").missing).toEqual(["pl"]);
  });

  it("counts missing required fields per language", () => {
    expect(check("translations").missing).toEqual({ de: 3, pl: 1 });
  });

  it("does not ask for alt text without a cover image", () => {
    const withoutCover = articleChecks({
      locales: ["en"],
      outdated: [],
      source: "en",
      values: { ...values, coverImage: null },
    });

    expect(withoutCover.find(item => item.id === "alt")?.ok).toBe(true);
    expect(withoutCover.find(item => item.id === "cover")?.ok).toBe(false);
  });

  it("passes through outdated languages", () => {
    expect(check("outdated")).toEqual({
      id: "outdated",
      ok: false,
      outdated: ["pl"],
    });
  });
});
