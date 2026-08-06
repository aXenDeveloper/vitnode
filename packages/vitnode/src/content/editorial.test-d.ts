import { assertType, describe, expectTypeOf, it } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
  testEditorialNoteContentType,
  testEditorialPostContentType,
  testPostContentType,
  testSearchablePostContentType,
} from "@/tests/content-fixtures";

import type { ContentEventsFor } from "./events";
import type {
  AnyContentTypeDefinition,
  ContentCreateInput,
  ContentOrderableFieldName,
  ContentSelect,
  ContentUpdateInput,
  EditorialContentTypeDefinition,
  PreviewableContentTypeDefinition,
  SchedulableContentTypeDefinition,
} from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";

type Editorial = typeof testEditorialPostContentType;
type Note = typeof testEditorialNoteContentType;
type Post = typeof testPostContentType;

describe("editorial", () => {
  // Three more type parameters on `ContentTypeDefinition`, and this is what says
  // they cost nothing: the erased form every relation thunk, registry and route
  // builder is written against still accepts every concrete definition.
  describe("assignability to AnyContentTypeDefinition", () => {
    it("holds for an editorial content type", () => {
      expectTypeOf<Editorial>().toExtend<AnyContentTypeDefinition>();
      assertType<AnyContentTypeDefinition>(testEditorialPostContentType);
      assertType<AnyContentTypeDefinition>(testEditorialNoteContentType);
    });

    it("still holds for every Stage 1-3 fixture", () => {
      assertType<AnyContentTypeDefinition>(testCategoryContentType);
      assertType<AnyContentTypeDefinition>(testArticleContentType);
      assertType<AnyContentTypeDefinition>(testPostContentType);
      assertType<AnyContentTypeDefinition>(testSearchablePostContentType);
    });
  });

  describe("the flags stay literal", () => {
    it("is `true` when opted in", () => {
      expectTypeOf(
        testEditorialPostContentType.editorial.enabled,
      ).toEqualTypeOf<true>();
      expectTypeOf(
        testEditorialPostContentType.editorial.preview.enabled,
      ).toEqualTypeOf<true>();
      expectTypeOf(
        testEditorialPostContentType.editorial.scheduling.enabled,
      ).toEqualTypeOf<true>();
    });

    it("is `false` when omitted", () => {
      expectTypeOf(
        testPostContentType.editorial.enabled,
      ).toEqualTypeOf<false>();
      expectTypeOf(
        testArticleContentType.editorial.enabled,
      ).toEqualTypeOf<false>();
    });

    it("keeps the two sub-features independent", () => {
      // Revisions without publication, so neither sub-feature is expressible.
      expectTypeOf(
        testEditorialNoteContentType.editorial.enabled,
      ).toEqualTypeOf<true>();
      expectTypeOf(
        testEditorialNoteContentType.editorial.preview.enabled,
      ).toEqualTypeOf<false>();
      expectTypeOf(
        testEditorialNoteContentType.editorial.scheduling.enabled,
      ).toEqualTypeOf<false>();
    });
  });

  describe("capability rules", () => {
    it("allows revisions with no publication and no public API", () => {
      expectTypeOf<Note>().toExtend<EditorialContentTypeDefinition>();
    });

    it("rejects preview without a public API", () => {
      defineContentType({
        id: "test.no-public",
        tableName: "test_no_public",
        fields: { title: field.text({ required: true }) },
        publication: { enabled: true },
        editorial: {
          enabled: true,
          // @ts-expect-error - preview projects through `publicApi.fields`
          preview: { enabled: true },
        },
        admin: { label: { plural: "Nopes", singular: "Nope" } },
      });
    });

    it("rejects scheduling without publication", () => {
      defineContentType({
        id: "test.no-lifecycle",
        tableName: "test_no_lifecycle",
        fields: { title: field.text({ required: true }) },
        editorial: {
          enabled: true,
          // @ts-expect-error - a schedule moves `status`
          scheduling: { enabled: true },
        },
        admin: { label: { plural: "Nopes", singular: "Nope" } },
      });
    });
  });

  describe("narrowing intersections", () => {
    it("pins the fully-configured content type", () => {
      expectTypeOf<Editorial>().toExtend<EditorialContentTypeDefinition>();
      expectTypeOf<Editorial>().toExtend<PreviewableContentTypeDefinition>();
      expectTypeOf<Editorial>().toExtend<SchedulableContentTypeDefinition>();
    });

    it("excludes a content type without the workflow", () => {
      expectTypeOf<Post>().not.toExtend<EditorialContentTypeDefinition>();
      expectTypeOf<Post>().not.toExtend<PreviewableContentTypeDefinition>();
      expectTypeOf<Post>().not.toExtend<SchedulableContentTypeDefinition>();
    });

    it("excludes an editorial content type that opted into neither extra", () => {
      expectTypeOf<Note>().not.toExtend<PreviewableContentTypeDefinition>();
      expectTypeOf<Note>().not.toExtend<SchedulableContentTypeDefinition>();
    });
  });

  describe("select output", () => {
    it("gains the generated version column", () => {
      expectTypeOf<
        ContentSelect<Editorial>["version"]
      >().toEqualTypeOf<number>();
      expectTypeOf<ContentSelect<Note>["version"]>().toEqualTypeOf<number>();
    });

    it("adds nothing to a content type without the workflow", () => {
      expectTypeOf<ContentSelect<Post>>().not.toHaveProperty("version");
      expectTypeOf<keyof ContentSelect<Note>>().toEqualTypeOf<
        "body" | "createdAt" | "id" | "title" | "updatedAt" | "version"
      >();
    });
  });

  describe("write input", () => {
    it("never exposes the version column", () => {
      expectTypeOf<ContentCreateInput<Editorial>>().not.toHaveProperty(
        "version",
      );
      expectTypeOf<ContentUpdateInput<Editorial>>().not.toHaveProperty(
        "version",
      );

      assertType<ContentUpdateInput<Editorial>>({
        title: "Hello",
        // @ts-expect-error - the version moves with the write, never in it
        version: 2,
      });
    });
  });

  // The R1 case from the Stage 4 plan: the reserved-name check has to resolve
  // `TEditorial` before `TFields` is checked against its constraint. The runtime
  // `assertFieldName` guard covers a JavaScript caller either way, but this is
  // what makes the mistake visible in the editor.
  describe("reserved field names", () => {
    it("rejects `version` once editorial is enabled", () => {
      defineContentType({
        id: "test.clash-version",
        tableName: "test_clash_version",
        fields: {
          title: field.text({ required: true }),
          // @ts-expect-error - generated by `editorial`
          version: field.number({ integer: true, defaultValue: 0 }),
        },
        editorial: { enabled: true },
        admin: { label: { plural: "Clashes", singular: "Clash" } },
      });
    });

    it("still allows it without editorial", () => {
      const withOwnVersion = defineContentType({
        id: "test.own-version",
        tableName: "test_own_version",
        fields: {
          title: field.text({ required: true }),
          version: field.number({ integer: true, defaultValue: 0 }),
        },
        admin: { label: { plural: "Fine", singular: "Fine" } },
      });

      expectTypeOf(withOwnVersion.editorial.enabled).toEqualTypeOf<false>();
      // Its own declared field, so it is writable - unlike the generated column.
      expectTypeOf<
        ContentUpdateInput<typeof withOwnVersion>["version"]
      >().toEqualTypeOf<number | undefined>();
    });
  });

  describe("admin config", () => {
    it("accepts the generated column once enabled", () => {
      defineContentType({
        id: "test.version-column",
        tableName: "test_version_column",
        fields: { title: field.text({ required: true }) },
        editorial: { enabled: true },
        admin: {
          label: { plural: "Columns", singular: "Column" },
          list: { columns: ["title", "version"], defaultOrderBy: "version" },
        },
      });
    });

    it("rejects it when editorial is off", () => {
      defineContentType({
        id: "test.no-version-column",
        tableName: "test_no_version_column",
        fields: { title: field.text({ required: true }) },
        admin: {
          label: { plural: "Columns", singular: "Column" },
          // @ts-expect-error - `version` is not a column of this content type
          list: { columns: ["title", "version"] },
        },
      });
    });
  });

  describe("derived type aliases", () => {
    it("adds the generated column to the orderable union", () => {
      expectTypeOf<ContentOrderableFieldName<Note>>().toEqualTypeOf<
        "body" | "createdAt" | "id" | "title" | "updatedAt" | "version"
      >();
    });

    it("leaves the union alone without editorial", () => {
      expectTypeOf<
        ContentOrderableFieldName<typeof testCategoryContentType>
      >().toEqualTypeOf<"createdAt" | "id" | "title" | "updatedAt">();
    });
  });
});

describe("the events an editorial content type emits", () => {
  type PostEvents = ContentEventsFor<typeof testEditorialPostContentType>;
  type NoteEvents = ContentEventsFor<Note>;
  type PlainEvents = ContentEventsFor<typeof testCategoryContentType>;

  it("adds `restored` to any editorial content type", () => {
    expectTypeOf<PostEvents>().toHaveProperty(
      "content.test.editorial.restored",
    );
    expectTypeOf<NoteEvents>().toHaveProperty("content.test.note.restored");
  });

  it("does not add it without editorial", () => {
    type PlainKeys = keyof PlainEvents;

    expectTypeOf<"content.test.category.restored">().not.toExtend<PlainKeys>();
    // The three every content type gets, so the assertion above is not vacuous.
    expectTypeOf<"content.test.category.updated">().toExtend<PlainKeys>();
  });

  it("adds the schedule pair only with scheduling", () => {
    expectTypeOf<PostEvents>().toHaveProperty(
      "content.test.editorial.scheduled",
    );
    expectTypeOf<PostEvents>().toHaveProperty(
      "content.test.editorial.schedule_cancelled",
    );
  });

  it("withholds it from an editorial type that cannot schedule", () => {
    // `test.note` has editorial but no publication, so there is no `status` to
    // move and the keys must not exist at all.
    type NoteKeys = keyof NoteEvents;

    expectTypeOf<"content.test.note.scheduled">().not.toExtend<NoteKeys>();
    expectTypeOf<"content.test.note.schedule_cancelled">().not.toExtend<NoteKeys>();
    // The one it *does* get, so the assertion above is not vacuous.
    expectTypeOf<"content.test.note.restored">().toExtend<NoteKeys>();
  });

  it("carries who booked a schedule that fired", () => {
    expectTypeOf<
      PostEvents["content.test.editorial.published"]["scheduledBy"]
    >().toEqualTypeOf<null | number | undefined>();
  });
});
