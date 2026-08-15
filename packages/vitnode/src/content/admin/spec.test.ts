// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  testArticleContentType,
  testCategoryContentType,
  testLocalizedGuideContentType,
  testSectionedContentType,
} from "@/tests/content-fixtures";

import type { ContentSectionLabeller } from "./spec";

import { contentTypeName, humanizeFieldName } from "./labels";
import {
  buildContentColumnSpec,
  buildContentFormSpec,
  buildFormSchemaFromSpec,
  contentFormInitialValues,
  contentFormValuesToPayload,
  contentFormValuesToTranslations,
  contentLocalizedFieldNames,
  contentTitleFromValues,
} from "./spec";

const labelField = (name: string) => humanizeFieldName(name);
const labelEnum = (_field: string, value: string) => value.toUpperCase();

const formSpec = buildContentFormSpec({
  definition: testArticleContentType,
  labelEnum,
  labelField,
  pluginId: "@vitnode/example",
});

const columnSpecs = buildContentColumnSpec({
  definition: testArticleContentType,
  labelEnum,
  labelField,
});

const REF = { label: "News", value: "1" };

const specFor = (name: string) => {
  const found = formSpec.fields.find(item => item.name === name);
  if (!found) throw new Error(`no spec for ${name}`);

  return found;
};

describe("contentTitleFromValues", () => {
  it("reads the content type's title field", () => {
    expect(contentTitleFromValues(formSpec, { title: "Hello" })).toBe("Hello");
  });

  it("gives up on a blank or missing title", () => {
    expect(contentTitleFromValues(formSpec, { title: "   " })).toBeUndefined();
    expect(contentTitleFromValues(formSpec, {})).toBeUndefined();
  });

  it("gives up when the content type has no title field", () => {
    expect(
      contentTitleFromValues(
        { ...formSpec, titleField: null },
        { title: "Hello" },
      ),
    ).toBeUndefined();
  });
});

describe("buildContentFormSpec", () => {
  it("is plain JSON, so it can cross the server/client boundary", () => {
    expect(JSON.parse(JSON.stringify(formSpec))).toEqual(formSpec);
  });

  it("carries the title field the toasts describe a new row by", () => {
    expect(formSpec.titleField).toBe("title");
  });

  it("covers exactly the declared form fields", () => {
    expect(formSpec.fields.map(item => item.name)).toEqual(
      testArticleContentType.admin.form.fields,
    );
  });

  it("humanises a field name when the plugin has no translation", () => {
    expect(specFor("publishedAt").label).toBe("Published at");
  });

  it("carries enum options with translated labels", () => {
    expect(specFor("status").options).toEqual([
      { label: "DRAFT", value: "draft" },
      { label: "PUBLISHED", value: "published" },
      { label: "ARCHIVED", value: "archived" },
    ]);
  });

  it("carries the validation bounds the form needs", () => {
    expect(specFor("title")).toMatchObject({
      maxLength: 200,
      minLength: 3,
      required: true,
    });
    expect(specFor("views")).toMatchObject({ integer: true, min: 0 });
  });

  it("keeps nullability", () => {
    expect(specFor("excerpt").nullable).toBe(true);
    expect(specFor("title").nullable).toBe(false);
  });

  it("names the content type a relation points at", () => {
    // Resolved from the `target` thunk here because a thunk cannot cross into a
    // client component - and the browser needs it to know that the category
    // picker on this form and the category screen show the same rows.
    expect(specFor("category").targetContentTypeId).toBe(
      testCategoryContentType.id,
    );
  });

  it("leaves a user field without one, because people are not a content type", () => {
    expect(specFor("author").targetContentTypeId).toBeUndefined();
  });

  describe("sections", () => {
    const sectioned = (labelSection?: ContentSectionLabeller) =>
      buildContentFormSpec({
        definition: testSectionedContentType,
        labelEnum,
        labelField,
        labelSection,
        pluginId: "@vitnode/example",
      });

    it("is empty for a content type that declares none", () => {
      expect(formSpec.sections).toEqual([]);
    });

    it("carries the groups, in order, with their fields", () => {
      expect(
        sectioned().sections.map(section => [section.name, section.fields]),
      ).toEqual([
        ["general", ["title", "excerpt"]],
        ["visibility", ["featured"]],
      ]);
    });

    it("carries headings already translated", () => {
      // Resolved on the server, like an enum's options: the client half of the
      // form has neither the plugin's messages nor the request's locale.
      const [general] = sectioned(name => ({
        desc: `${name} desc`,
        title: `${name} title`,
      })).sections;

      expect(general).toMatchObject({
        desc: "general desc",
        title: "general title",
      });
    });

    it("humanises a heading the plugin has not translated", () => {
      expect(sectioned().sections[1]).toEqual({
        fields: ["featured"],
        name: "visibility",
        title: "Visibility",
      });
    });

    it("omits a field no section names", () => {
      // `views` is in no section, so it is not on the form - the same contract
      // `admin.form.fields` has.
      expect(sectioned().fields.map(item => item.name)).toEqual([
        "title",
        "excerpt",
        "featured",
      ]);
    });

    it("stays plain JSON", () => {
      const spec = sectioned();

      expect(JSON.parse(JSON.stringify(spec))).toEqual(spec);
    });
  });
});

describe("buildContentColumnSpec", () => {
  it("marks the system columns", () => {
    expect(columnSpecs.find(item => item.name === "updatedAt")?.kind).toBe(
      "system",
    );
  });

  it("keeps the declared column order", () => {
    expect(columnSpecs.map(item => item.name)).toEqual([
      "title",
      "status",
      "author",
      "updatedAt",
    ]);
  });

  it("carries an enum lookup for badge cells", () => {
    expect(columnSpecs.find(item => item.name === "status")?.options).toEqual({
      archived: "ARCHIVED",
      draft: "DRAFT",
      published: "PUBLISHED",
    });
  });
});

describe("buildFormSchemaFromSpec", () => {
  const schema = buildFormSchemaFromSpec(formSpec);

  it("survives z.toJSONSchema, which AutoForm runs on every schema", () => {
    expect(() => z.toJSONSchema(schema)).not.toThrow();
  });

  it("prefills AutoForm from the declared defaults", () => {
    const json = z.toJSONSchema(schema);

    expect(json.properties?.status).toMatchObject({ default: "draft" });
    expect(json.properties?.featured).toMatchObject({ default: false });
    expect(json.properties?.views).toMatchObject({ default: 0 });
  });

  it("prefills from an existing row when editing", () => {
    const json = z.toJSONSchema(
      buildFormSchemaFromSpec(formSpec, {
        status: "published",
        title: "Existing",
      }),
    );

    expect(json.properties?.title).toMatchObject({ default: "Existing" });
    expect(json.properties?.status).toMatchObject({ default: "published" });
  });

  it("enforces the same bounds as the API", () => {
    expect(schema.safeParse({ category: REF, title: "ab" }).success).toBe(
      false,
    );
    expect(schema.safeParse({ category: REF, title: "Hello" }).success).toBe(
      true,
    );
  });

  it("rejects a value outside the enum", () => {
    expect(
      schema.safeParse({ category: REF, status: "nope", title: "Hello" })
        .success,
    ).toBe(false);
  });

  it("takes dateTime as an ISO string, never a Date", () => {
    expect(
      schema.safeParse({
        category: REF,
        publishedAt: "2026-08-02T10:00:00.000Z",
        title: "Hello",
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        category: REF,
        publishedAt: new Date(),
        title: "Hello",
      }).success,
    ).toBe(false);
  });

  it("models a relation as the option object AutoFormCombobox stores", () => {
    const option = { label: "News", value: "3" };

    expect(schema.safeParse({ category: option, title: "Hello" }).success).toBe(
      true,
    );
    // A bare identifier is what the API takes, not what the form holds.
    expect(schema.safeParse({ category: 3, title: "Hello" }).success).toBe(
      false,
    );
  });

  it("rejects a required relation left unselected", () => {
    expect(
      schema.safeParse({ category: { label: "", value: "" }, title: "Hello" })
        .success,
    ).toBe(false);
  });

  it("prefills a relation with the label the list already resolved", () => {
    const json = z.toJSONSchema(
      buildFormSchemaFromSpec(formSpec, {
        category: 3,
        labels: { category: "News" },
        title: "Existing",
      }),
      { io: "input" },
    );

    expect(json.properties?.category).toMatchObject({
      default: { label: "News", value: "3" },
    });
  });

  it("accepts what a number input actually produces - a string", () => {
    expect(
      schema.parse({ category: REF, title: "Hello", views: "7" }).views,
    ).toBe(7);
  });

  it("treats an empty date input as no value rather than an invalid date", () => {
    const parsed = schema.parse({
      category: REF,
      publishedAt: "",
      title: "Hello",
    });

    expect(parsed.publishedAt).toBeNull();
  });

  it("converts form values into the API payload", () => {
    expect(
      contentFormValuesToPayload(formSpec, {
        author: null,
        category: { label: "News", value: "3" },
        title: "Hello",
      }),
    ).toEqual({ author: null, category: 3, title: "Hello" });
  });

  it("stays valid with every value exactly as the DOM reports it", () => {
    // This is the combination that previously left the submit button disabled
    // forever with no visible error.
    const result = schema.safeParse({
      author: null,
      category: { label: "News", value: "1" },
      excerpt: "",
      featured: false,
      publishedAt: "",
      status: "draft",
      title: "QA Article",
      views: "0",
    });

    expect(result.success).toBe(true);
  });

  it("accepts null only for nullable fields", () => {
    expect(
      schema.safeParse({ category: REF, excerpt: null, title: "Hello" })
        .success,
    ).toBe(true);
    expect(schema.safeParse({ category: REF, title: null }).success).toBe(
      false,
    );
  });
});

describe("humanizeFieldName", () => {
  it.each([
    ["publishedAt", "Published at"],
    ["title", "Title"],
    ["author_id", "Author id"],
    ["viewsCount", "Views count"],
  ])("turns %s into %s", (input, expected) => {
    expect(humanizeFieldName(input)).toBe(expected);
  });
});

describe("contentTypeName", () => {
  // What an OpenAPI description, an API error and an untranslated AdminCP all
  // read now that no definition carries a display name.
  it.each([
    ["blog.post", "Post"],
    ["example.kb.article", "Kb article"],
    ["example.stock-item", "Stock item"],
  ])("names %s %s", (id, expected) => {
    expect(contentTypeName(id)).toBe(expected);
  });

  it("drops the plugin segment rather than reading it back", () => {
    // The plugin already names itself everywhere this appears - in the route
    // path, in the message namespace and in the AdminCP's own navigation.
    expect(contentTypeName("blog.post")).not.toContain("blog");
  });
});

/**
 * The AdminCP form adapter: translation rows in, per-field per-language values
 * out, and back again.
 *
 * The one place where "how localization is stored" and "how localization is
 * edited" meet. Storage does not move - a base row and one translation row per
 * language, each with its own version - and neither does the form's shape: a
 * localized field holds the `{ languageCode, value }[]` VitNode has always used
 * for a language-aware input.
 */
describe("the localized form adapter", () => {
  const localizedSpec = buildContentFormSpec({
    definition: testLocalizedGuideContentType,
    labelEnum,
    labelField,
    pluginId: "@vitnode/example",
  });

  const translations = [
    { locale: "en", values: { body: "Body", slug: "hello", title: "Hello" } },
    { locale: "pl", values: { body: "Treść", slug: "witaj", title: "Witaj" } },
  ];

  it("puts localized and shared fields in one form spec", () => {
    const names = localizedSpec.fields.map(field => field.name);

    expect(names).toContain("title");
    expect(names).toContain("featured");
  });

  it("flags the localized ones, so their inputs grow a language switcher", () => {
    expect(contentLocalizedFieldNames(localizedSpec)).toEqual([
      "title",
      "slug",
      "body",
      "summary",
    ]);
  });

  it("carries the default locale without making it a display choice", () => {
    // The language a record must exist in. Which language an editor *sees* is
    // their own global locale, and this is not it.
    expect(localizedSpec.defaultLocale).toBe("en");
  });

  it("folds translation rows into per-field, per-language values", () => {
    const values = contentFormInitialValues(
      localizedSpec,
      { featured: true, id: 7 },
      translations,
    );

    expect(values?.featured).toBe(true);
    expect(values?.title).toEqual([
      { languageCode: "en", value: "Hello" },
      { languageCode: "pl", value: "Witaj" },
    ]);
  });

  it("splits submitted values back into a base row and translation rows", () => {
    const submitted = {
      featured: true,
      title: [
        { languageCode: "en", value: "Hello" },
        { languageCode: "pl", value: "Witaj" },
      ],
    };

    expect(contentFormValuesToPayload(localizedSpec, submitted)).toEqual({
      featured: true,
    });
    expect(contentFormValuesToTranslations(localizedSpec, submitted)).toEqual({
      en: { title: "Hello" },
      pl: { title: "Witaj" },
    });
  });

  it("says nothing about a language nobody typed into", () => {
    // Selecting a language to read what is there must not create a translation.
    expect(
      contentFormValuesToTranslations(localizedSpec, {
        title: [
          { languageCode: "en", value: "Hello" },
          { languageCode: "pl", value: "" },
        ],
      }),
    ).toEqual({ en: { title: "Hello" } });
  });

  it("treats an empty localized slug as 'derive it', not as an empty slug", () => {
    expect(
      contentFormValuesToTranslations(localizedSpec, {
        slug: [{ languageCode: "en", value: "" }],
        title: [{ languageCode: "en", value: "Hello" }],
      }),
    ).toEqual({ en: { title: "Hello" } });
  });

  it("clears a nullable localized field to null rather than to nothing", () => {
    expect(
      contentFormValuesToTranslations(localizedSpec, {
        summary: [{ languageCode: "en", value: "" }],
      }),
    ).toEqual({ en: { summary: null } });
  });

  it("names the record in the language the editor is working in", () => {
    const values = { title: [{ languageCode: "pl", value: "Witaj" }] };

    expect(contentTitleFromValues(localizedSpec, values, "pl")).toBe("Witaj");
    expect(contentTitleFromValues(localizedSpec, values, "en")).toBeUndefined();
  });
});

describe("the localized form schema", () => {
  const localizedSpec = buildContentFormSpec({
    definition: testLocalizedGuideContentType,
    labelEnum,
    labelField,
    pluginId: "@vitnode/example",
  });
  const schema = buildFormSchemaFromSpec(localizedSpec);

  const parse = (title: { languageCode: string; value: string }[]) =>
    schema.safeParse({ featured: false, title });

  it("accepts a language nobody has written yet", () => {
    // Absent, not "too short". A missing translation is a state, not an error.
    expect(parse([{ languageCode: "en", value: "Hello" }]).success).toBe(true);
  });

  it("requires the default language of a required field", () => {
    const result = parse([{ languageCode: "pl", value: "Witaj" }]);

    expect(result.success).toBe(false);
    // The message names the field *and* the language, because "required" on its
    // own would leave an editor looking at a filled-in box.
    expect(result.error?.issues[0].message).toContain("Title");
    expect(result.error?.issues[0].message).toContain("en");
  });

  it("applies the field's own length rules to a language that was written", () => {
    const result = schema.safeParse({
      featured: false,
      title: [
        { languageCode: "en", value: "Hello" },
        // 200 is `title`'s maxLength on this fixture.
        { languageCode: "pl", value: "x".repeat(201) },
      ],
    });

    expect(result.success).toBe(false);
  });
});
