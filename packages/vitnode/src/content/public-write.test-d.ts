import { describe, it } from "vitest";

import { defineContentType } from "./define";
import { field } from "./fields";

const base = {
  id: "test.thread",
  tableName: "test_threads",
  publication: true,
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    excerpt: field.textarea({ nullable: true }),
    author: field.user(),
    editors: field.user({ multiple: true }),
    cover: field.file({
      maxBytes: 1024,
      allowedExtensions: [".png"],
      allowedMimeTypes: ["image/png"],
    }),
  },
  publicApi: { path: "threads", fields: ["title", "slug"] },
} as const;

const ownership = { field: "author" } as const;

describe("publicWrite allowlists", () => {
  it("accepts writable kinds", () => {
    defineContentType({
      ...base,
      publicWrite: {
        ownership,
        create: { fields: ["title", "excerpt"] },
        update: { fields: ["excerpt"] },
      },
    });
  });

  it("rejects fields the server owns", () => {
    defineContentType({
      ...base,
      // @ts-expect-error - the owner is stamped by the server
      publicWrite: { ownership, update: { fields: ["author"] } },
    });
    defineContentType({
      ...base,
      // @ts-expect-error - `slug` is derived from `title` on the server
      publicWrite: { ownership, update: { fields: ["slug"] } },
    });
    defineContentType({
      ...base,
      // @ts-expect-error - a file id names somebody's upload
      publicWrite: { ownership, update: { fields: ["cover"] } },
    });
  });

  it("rejects an ownership field that is not a single user", () => {
    defineContentType({
      ...base,
      publicWrite: {
        // @ts-expect-error - one record has one owner
        ownership: { field: "editors" },
        update: { fields: ["title"] },
      },
    });
  });

  it("rejects publicWrite without a public API", () => {
    const { publicApi: _publicApi, ...withoutPublicApi } = base;

    defineContentType({
      ...withoutPublicApi,
      // @ts-expect-error - the write routes live beside the public reads
      publicWrite: { ownership, update: { fields: ["title"] } },
    });
  });
});
