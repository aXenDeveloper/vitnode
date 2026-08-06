// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  testArticleContentType,
  testLocalizedArticleContentType,
  testLocalizedNoteContentType,
} from "@/tests/content-fixtures";

const { schemas } = testLocalizedArticleContentType;

/** Non-null because the fixture is localized - see `translation-table.test.ts`. */
const translation = (() => {
  if (!schemas.translation) {
    throw new Error("Expected generated translation schemas.");
  }

  return schemas.translation;
})();

describe("shared schemas of a localized content type", () => {
  it("accept the shared fields", () => {
    expect(schemas.create.parse({ featured: true, views: 3 })).toEqual({
      featured: true,
      views: 3,
    });
  });

  it("apply the declared defaults, exactly as before", () => {
    expect(schemas.create.parse({})).toEqual({ featured: false, views: 0 });
  });

  it("reject a localized field as a base value", () => {
    // Strict, so a localized value cannot be smuggled into the base insert -
    // there is no column for it, and quietly stripping it would lose the text.
    expect(() => schemas.create.parse({ title: "Hello" })).toThrow();
    expect(() => schemas.update.parse({ title: "Hello" })).toThrow();
  });

  it("keep localized fields out of the response shape", () => {
    expect(Object.keys(schemas.selectObject.shape).sort()).toEqual([
      "createdAt",
      "featured",
      "id",
      "updatedAt",
      "views",
    ]);
  });

  it("keep localized fields out of the filter and form shapes", () => {
    expect(Object.keys(schemas.filters.shape)).not.toContain("title");
    expect(Object.keys(schemas.form.shape)).toEqual(["featured", "views"]);
  });
});

describe("translation create", () => {
  it("accepts the localized values", () => {
    expect(translation.create.parse({ body: "Body", title: "Hello" })).toEqual({
      body: "Body",
      title: "Hello",
    });
  });

  it("requires a required localized field", () => {
    expect(() => translation.create.parse({ body: "Body" })).toThrow();
  });

  it("leaves a sourced slug optional and requires a sourceless one", () => {
    expect(translation.create.parse({ title: "Hello" })).toEqual({
      title: "Hello",
    });

    const notes = testLocalizedNoteContentType.schemas.translation;
    expect(() => notes?.create.parse({ heading: "Hi" })).toThrow();
  });

  it("accepts null for a nullable localized field", () => {
    expect(translation.create.parse({ body: null, title: "Hello" })).toEqual({
      body: null,
      title: "Hello",
    });
  });

  it("is strict, so an unknown key is an error", () => {
    expect(() =>
      translation.create.parse({ nope: 1, title: "Hello" }),
    ).toThrow();
  });

  it.each(["itemId", "languageId", "version", "locale", "expectedVersion"])(
    "refuses %s as a content value",
    key => {
      // Identity and transport are not content. Accepting any of these inside
      // `values` would make them mass-assignable.
      expect(() =>
        translation.create.parse({ [key]: 1, title: "Hello" }),
      ).toThrow();
    },
  );

  it("wraps the values in an envelope on the wire", () => {
    expect(
      translation.createEnvelope.parse({ values: { title: "Hello" } }),
    ).toEqual({ values: { title: "Hello" } });
    expect(() =>
      translation.createEnvelope.parse({ title: "Hello" }),
    ).toThrow();
  });
});

describe("translation update", () => {
  it("makes every localized field optional", () => {
    expect(translation.update.parse({ title: "New" })).toEqual({
      title: "New",
    });
  });

  it("refuses an empty patch", () => {
    // A `PUT` that names no field is a request that means nothing, and it would
    // otherwise burn a version check for no reason.
    expect(() => translation.update.parse({})).toThrow();
  });

  it("never applies create defaults", () => {
    expect(translation.update.parse({ body: "Body" })).toEqual({
      body: "Body",
    });
  });

  it("carries `expectedVersion` beside the values, not inside them", () => {
    expect(
      translation.updateEnvelope.parse({
        expectedVersion: 3,
        values: { title: "Nowy tytuł" },
      }),
    ).toEqual({ expectedVersion: 3, values: { title: "Nowy tytuł" } });
  });

  it.each([0, -1, 1.5])("refuses expectedVersion %s", expectedVersion => {
    // Positive integers only, so a client that forgot to send one cannot coerce
    // `0` past the guard and race the very check it is meant to lose.
    expect(() =>
      translation.updateEnvelope.parse({
        expectedVersion,
        values: { title: "New" },
      }),
    ).toThrow();
  });

  it("refuses an update envelope with an empty patch", () => {
    expect(() =>
      translation.updateEnvelope.parse({ expectedVersion: 1, values: {} }),
    ).toThrow();
  });
});

describe("translation select", () => {
  it("nests the values under `values` beside the metadata", () => {
    expect(Object.keys(translation.select.shape).sort()).toEqual([
      "createdAt",
      "itemId",
      "languageId",
      "locale",
      "updatedAt",
      "values",
      "version",
    ]);
  });

  it("has a metadata-only shape for the list route", () => {
    // A locale strip needs to know which languages exist, not to drag every
    // article body in every language across the wire to find out.
    expect(Object.keys(translation.selectMeta.shape).sort()).toEqual([
      "createdAt",
      "itemId",
      "languageId",
      "locale",
      "updatedAt",
      "version",
    ]);
  });

  it("coerces the item id and keeps the locale a plain string", () => {
    expect(translation.params.parse({ id: "12", locale: "pl" })).toEqual({
      id: 12,
      locale: "pl",
    });
  });

  it("refuses a locale wider than core_languages.code", () => {
    expect(() =>
      translation.params.parse({ id: "1", locale: "x".repeat(33) }),
    ).toThrow();
  });
});

describe("a content type without localization", () => {
  it("has no translation schemas at all", () => {
    expect(testArticleContentType.schemas.translation).toBeNull();
  });

  it("keeps every generated schema it had", () => {
    expect(Object.keys(testArticleContentType.schemas.form.shape)).toEqual(
      Object.keys(testArticleContentType.fields),
    );
  });
});
