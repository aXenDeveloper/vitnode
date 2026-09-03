// @vitest-environment node
import { describe, expect, it } from "vitest";

import { humanizeFieldName } from "@/content/admin/labels";
import { buildContentFormSpec } from "@/content/admin/spec";
import {
  testAdvancedLocalizedContentType,
  testArticleContentType,
  testFileGalleryContentType,
  testLocalizedGuideContentType,
} from "@/tests/content-fixtures";

import type { TranslationRow } from "../content-mutation";

import {
  contentSharedChanged,
  contentTranslationDiff,
  missingContentCollections,
} from "./diff";

const labelField = (name: string) => humanizeFieldName(name);
const labelEnum = (_field: string, value: string) => value.toUpperCase();

const specOf = (
  definition: Parameters<typeof buildContentFormSpec>[0]["definition"],
) =>
  buildContentFormSpec({
    definition,
    labelEnum,
    labelField,
    pluginId: "@vitnode/example",
  });

const gallerySpec = specOf(testFileGalleryContentType);
const repeatableSpec = specOf(testAdvancedLocalizedContentType);
const articleSpec = specOf(testArticleContentType);
const guideSpec = specOf(testLocalizedGuideContentType);

const translation = (
  locale: string,
  values: Record<string, unknown>,
  version = 3,
): TranslationRow => ({
  itemId: 7,
  languageId: 1,
  locale,
  values,
  version,
});

describe("missingContentCollections", () => {
  it("finds nothing on a content type that has no collection field", () => {
    // Every value on this content type lives on the row, so a list row is
    // already a complete record and a dialog costs no extra request.
    expect(missingContentCollections(articleSpec, { id: 1 })).toEqual([]);
  });

  it("names a gallery a list row left off", () => {
    // The failure this whole rule exists for: a `multiple: true` file field is
    // stored on a table of its own, the list does not join it, and a form that
    // opened on `[]` would save an article with no images.
    expect(missingContentCollections(gallerySpec, { id: 1 })).toContain(
      "gallery",
    );
  });

  it("names a repeatable a list row left off", () => {
    expect(missingContentCollections(repeatableSpec, { id: 1 })).toContain(
      "faq",
    );
  });

  it("treats an empty array as an answer, not as an absence", () => {
    // A record that genuinely has no rows arrives as `[]`. Re-reading the detail
    // for it would cost one request per dialog and change nothing.
    expect(
      missingContentCollections(gallerySpec, { gallery: [], id: 1 }),
    ).not.toContain("gallery");
  });

  it("treats a populated collection as present", () => {
    expect(
      missingContentCollections(repeatableSpec, {
        faq: [{ answer: "Yes", question: "Does it?" }],
        id: 1,
      }),
    ).not.toContain("faq");
  });

  it("does not name a single-valued file field", () => {
    // One `file` is a column on the row - only `multiple: true` is a collection.
    expect(missingContentCollections(gallerySpec, { id: 1 })).not.toContain(
      "cover",
    );
  });
});

describe("contentTranslationDiff", () => {
  const submitted = {
    featured: true,
    title: [
      { languageCode: "en", value: "Hello" },
      { languageCode: "pl", value: "Witaj" },
    ],
  };

  it("sends a language the record has no translation in, whole and unguarded", () => {
    // Nothing to be stale against, so no precondition - the API creates it.
    expect(contentTranslationDiff(guideSpec, submitted, [])).toEqual([
      { locale: "en", values: { title: "Hello" } },
      { locale: "pl", values: { title: "Witaj" } },
    ]);
  });

  it("sends only the fields that moved, with that language's own version", () => {
    const opened = [
      translation("en", { title: "Hello" }, 4),
      translation("pl", { title: "Stary" }, 9),
    ];

    expect(contentTranslationDiff(guideSpec, submitted, opened)).toEqual([
      { expectedVersion: 9, locale: "pl", values: { title: "Witaj" } },
    ]);
  });

  it("says nothing at all when no language moved", () => {
    const opened = [
      translation("en", { title: "Hello" }),
      translation("pl", { title: "Witaj" }),
    ];

    // The whole point: a save that changed only a shared field must not write an
    // English revision, fire an English event or expire the English cache.
    expect(contentTranslationDiff(guideSpec, submitted, opened)).toEqual([]);
  });

  it("matches a locale case-insensitively", () => {
    // The switcher keys by the code the definition declares; the API answers
    // with the code stored in `core_languages`. `pl` and `PL` are one language,
    // and treating them as two would send a create for a translation that
    // already exists - which the API refuses.
    const opened = [
      translation("EN", { title: "Hello" }, 2),
      translation("PL", { title: "Witaj" }, 5),
    ];

    expect(contentTranslationDiff(guideSpec, submitted, opened)).toEqual([]);
  });

  it("keeps the locale exactly as the record spells it", () => {
    // The address the API is asked about is the row's own locale, not the one
    // the form happened to key by.
    const opened = [translation("PL", { title: "Stary" }, 5)];

    expect(
      contentTranslationDiff(guideSpec, submitted, opened).find(
        entry => entry.expectedVersion !== undefined,
      )?.locale,
    ).toBe("PL");
  });

  it("carries the version each language was loaded at, not one shared version", () => {
    const opened = [
      translation("en", { title: "Old" }, 4),
      translation("pl", { title: "Stary" }, 9),
    ];

    expect(
      Object.fromEntries(
        contentTranslationDiff(guideSpec, submitted, opened).map(entry => [
          entry.locale,
          entry.expectedVersion,
        ]),
      ),
    ).toEqual({ en: 4, pl: 9 });
  });
});

describe("contentSharedChanged", () => {
  it("is true for a create, which has nothing to compare against", () => {
    expect(contentSharedChanged(undefined, { title: "Hello" })).toBe(true);
  });

  it("is false when every field in the payload still holds what it held", () => {
    expect(
      contentSharedChanged(
        { featured: true, id: 7, title: "Hello" },
        { featured: true, title: "Hello" },
      ),
    ).toBe(false);
  });

  it("ignores columns the form does not edit", () => {
    // `version`, `updatedAt` and `labels` move on their own and must never make
    // a save look necessary - only the payload's keys are compared.
    expect(
      contentSharedChanged(
        { id: 7, title: "Hello", updatedAt: "2026-01-01", version: 4 },
        { title: "Hello" },
      ),
    ).toBe(false);
  });

  it("sees a scalar change", () => {
    expect(contentSharedChanged({ title: "Hello" }, { title: "Hi" })).toBe(
      true,
    );
  });

  it("sees a value that was absent from the row", () => {
    expect(contentSharedChanged({ id: 7 }, { title: "Hello" })).toBe(true);
  });

  it("compares an array element by element", () => {
    expect(
      contentSharedChanged({ categories: [3, 9] }, { categories: [3, 9] }),
    ).toBe(false);
    expect(
      contentSharedChanged({ categories: [3, 9] }, { categories: [3] }),
    ).toBe(true);
  });

  it("treats a reordered to-many field as a change", () => {
    // An ordered relation stores its order, so `[9, 3]` is not `[3, 9]`.
    expect(
      contentSharedChanged({ categories: [3, 9] }, { categories: [9, 3] }),
    ).toBe(true);
  });
});
