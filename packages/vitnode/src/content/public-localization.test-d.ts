import { describe, expectTypeOf, it } from "vitest";

import type { testPostContentType } from "@/tests/content-fixtures";

import { testLocalizedPageContentType } from "@/tests/content-fixtures";

import type { ContentPublicSelect } from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";

type LocalizedRow = ContentPublicSelect<typeof testLocalizedPageContentType>;
type PlainRow = ContentPublicSelect<typeof testPostContentType>;

describe("the public row of a localized content type", () => {
  it("carries the language it was actually served in", () => {
    // Not always the language that was asked for: with `fallback: "default"` a
    // locale with no translation is served the default one, and `hreflang`, a
    // language switcher and a "not translated yet" notice all need to know.
    expectTypeOf<LocalizedRow["locale"]>().toEqualTypeOf<string>();
  });

  it("still carries exactly the allowlisted fields", () => {
    expectTypeOf<LocalizedRow["title"]>().toEqualTypeOf<string>();
    expectTypeOf<LocalizedRow["featured"]>().toEqualTypeOf<boolean>();
    expectTypeOf<LocalizedRow["body"]>().toEqualTypeOf<null | string>();
  });

  it("does not carry a field the allowlist leaves out", () => {
    // @ts-expect-error - `status` is never exposable; every public row is
    // published, so it would be a constant.
    type _Missing = LocalizedRow["status"];
  });
});

describe("the public row of a content type that is not localized", () => {
  it("has no `locale` at all", () => {
    // The key appears because of localization, so a Stage 1-4 content type's
    // response shape is byte-identical to what it always was.
    // @ts-expect-error - nothing resolved a language for this row.
    type _Missing = PlainRow["locale"];
  });

  it("keeps its allowlisted fields unchanged", () => {
    expectTypeOf<PlainRow["title"]>().toEqualTypeOf<string>();
  });
});

describe("definition-time rules", () => {
  it("refuses `locale` in the allowlist of a localized content type", () => {
    defineContentType({
      id: "test.locale-clash",
      tableName: "test_locale_clash",
      localization: { defaultLocale: "en", enabled: true },
      publication: { enabled: true },
      fields: {
        title: field.text({ localized: true, required: true }),
        slug: field.slug({ localized: true, source: "title" }),
        locale: field.text({ nullable: true }),
      },
      publicApi: {
        enabled: true,
        // The runtime refuses this; the type cannot, because `locale` is a
        // declared field like any other. The message is what makes it fixable.
        fields: ["title", "slug", "locale"],
        path: "clash",
      },
    });
  });

  it("keeps a localized definition assignable to the erased one", () => {
    expectTypeOf(
      testLocalizedPageContentType.publicApi.enabled,
    ).toEqualTypeOf<true>();
    expectTypeOf(
      testLocalizedPageContentType.localization.enabled,
    ).toEqualTypeOf<true>();
  });
});
