import { assertType, describe, expectTypeOf, it } from "vitest";

import type { testEditorialTopicContentType } from "@/tests/content-fixtures";

import {
  testPostContentType,
  testTopicContentType,
} from "@/tests/content-fixtures";

import type { RichTextDocument } from "./rich-text/document";
import type {
  AnyContentTypeDefinition,
  ContentPublicationStatus,
  ContentPublicCreateBody,
  ContentPublicCreateFieldName,
  ContentPublicUpdateBody,
  ContentPublicUpdateFieldName,
  ContentPublicWriteRecord,
  PublicWritableContentTypeDefinition,
} from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";

type Topic = typeof testTopicContentType;
type EditorialTopic = typeof testEditorialTopicContentType;
type Post = typeof testPostContentType;

const fields = {
  title: field.text({ required: true, maxLength: 200 }),
  slug: field.slug({ source: "title" }),
  excerpt: field.textarea({ nullable: true }),
  closed: field.boolean({ defaultValue: false }),
  author: field.user(),
  editors: field.user({ multiple: true }),
  cover: field.file({
    maxBytes: 1024,
    allowedExtensions: [".png"],
    allowedMimeTypes: ["image/png"],
  }),
};

const publicApi = { path: "threads", fields: ["title", "slug"] } as const;

describe("publicWrite types", () => {
  describe("a write-enabled content type", () => {
    it("still extends AnyContentTypeDefinition", () => {
      expectTypeOf<Topic>().toExtend<AnyContentTypeDefinition>();
    });

    it("is a PublicWritableContentTypeDefinition", () => {
      assertType<PublicWritableContentTypeDefinition>(testTopicContentType);
      expectTypeOf<Post>().not.toExtend<PublicWritableContentTypeDefinition>();
    });

    it("keeps the enabled flags literal", () => {
      expectTypeOf<
        Topic["publicWrite"]["create"]["enabled"]
      >().toEqualTypeOf<true>();
      expectTypeOf<
        Topic["publicWrite"]["update"]["enabled"]
      >().toEqualTypeOf<true>();
    });

    it("reads the field-name unions off the allowlists", () => {
      expectTypeOf<ContentPublicCreateFieldName<Topic>>().toEqualTypeOf<
        "body" | "forum" | "title"
      >();
      expectTypeOf<
        ContentPublicUpdateFieldName<EditorialTopic>
      >().toEqualTypeOf<"title">();
    });

    it("types the create body: required where the field is, no owner", () => {
      type Values = ContentPublicCreateBody<Topic>["values"];

      expectTypeOf<Values>().toEqualTypeOf<{
        body: RichTextDocument;
        forum: number;
        title: string;
      }>();
      expectTypeOf<Values>().not.toHaveProperty("author");
      expectTypeOf<Values>().not.toHaveProperty("pinned");
    });

    it("makes every update field optional", () => {
      expectTypeOf<ContentPublicUpdateBody<Topic>>().toEqualTypeOf<{
        values: {
          body?: RichTextDocument;
          forum?: number;
          title?: string;
        };
      }>();
    });

    it("asks an editorial type for its version", () => {
      expectTypeOf<ContentPublicUpdateBody<EditorialTopic>>().toEqualTypeOf<{
        expectedVersion: number;
        values: { title?: string };
      }>();
    });

    it("answers with the record's address and its writable fields", () => {
      type Record = ContentPublicWriteRecord<Topic>;

      expectTypeOf<keyof Record>().toEqualTypeOf<
        "approval" | "id" | "publishedAt" | "slug" | "status" | "values"
      >();
      expectTypeOf<
        Record["status"]
      >().toEqualTypeOf<ContentPublicationStatus>();
      expectTypeOf<keyof Record["values"]>().toEqualTypeOf<
        "body" | "forum" | "title"
      >();
      expectTypeOf<ContentPublicWriteRecord<EditorialTopic>>().toHaveProperty(
        "version",
      );
    });
  });

  describe("a content type without publicWrite", () => {
    it("resolves every flag to a literal false", () => {
      expectTypeOf(
        testPostContentType.publicWrite.create.enabled,
      ).toEqualTypeOf<false>();
      expectTypeOf(
        testPostContentType.publicWrite.update.enabled,
      ).toEqualTypeOf<false>();
      expectTypeOf<ContentPublicCreateFieldName<Post>>().toEqualTypeOf<never>();
      expectTypeOf<ContentPublicUpdateFieldName<Post>>().toEqualTypeOf<never>();
    });
  });

  describe("the allowlists autocomplete only what can be written", () => {
    it("accepts writable kinds", () => {
      assertType(
        defineContentType({
          id: "test.thread",
          tableName: "test_threads",
          publication: true,
          fields,
          publicApi,
          publicWrite: {
            ownership: { field: "author" },
            create: { fields: ["title", "excerpt", "closed"] },
            update: { fields: ["excerpt"] },
          },
        }),
      );
    });

    it("rejects the ownership field", () => {
      assertType(
        defineContentType({
          id: "test.thread",
          tableName: "test_threads",
          publication: true,
          fields,
          publicApi,
          publicWrite: {
            ownership: { field: "author" },
            // @ts-expect-error - a user id names a person; the server stamps it.
            update: { fields: ["author"] },
          },
        }),
      );
    });

    it("rejects a slug derived from another field", () => {
      assertType(
        defineContentType({
          id: "test.thread",
          tableName: "test_threads",
          publication: true,
          fields,
          publicApi,
          publicWrite: {
            ownership: { field: "author" },
            // @ts-expect-error - `slug` is derived from `title` on the server.
            update: { fields: ["slug"] },
          },
        }),
      );
    });

    it("rejects a file field", () => {
      assertType(
        defineContentType({
          id: "test.thread",
          tableName: "test_threads",
          publication: true,
          fields,
          publicApi,
          publicWrite: {
            ownership: { field: "author" },
            // @ts-expect-error - a file id names somebody's upload.
            update: { fields: ["cover"] },
          },
        }),
      );
    });

    it("rejects an ownership field that is not a single user", () => {
      assertType(
        defineContentType({
          id: "test.thread",
          tableName: "test_threads",
          publication: true,
          fields,
          publicApi,
          publicWrite: {
            // @ts-expect-error - one record has one owner.
            ownership: { field: "editors" },
            update: { fields: ["title"] },
          },
        }),
      );
    });

    it("rejects publicWrite without a public API", () => {
      assertType(
        defineContentType({
          id: "test.thread",
          tableName: "test_threads",
          publication: true,
          fields,
          // @ts-expect-error - the write routes live beside the public reads.
          publicWrite: {
            ownership: { field: "author" },
            update: { fields: ["title"] },
          },
        }),
      );
    });
  });
});
