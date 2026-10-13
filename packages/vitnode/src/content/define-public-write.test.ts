import { describe, expect, it } from "vitest";

import {
  testCategoryContentType,
  testForumContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import { defineContentContainer } from "./containers/define";
import { defineContentType } from "./define";
import { ContentEngineError } from "./errors";
import { field } from "./fields";

const boards = defineContentContainer({ id: "test.boards" });

const fields = {
  title: field.text({ required: true, maxLength: 200 }),
  slug: field.slug({ source: "title" }),
  handle: field.slug(),
  excerpt: field.textarea({ nullable: true }),
  body: field.richText({ nullable: true }),
  rating: field.number({ integer: true, nullable: true }),
  closed: field.boolean({ defaultValue: false }),
  mood: field.enum({ values: ["calm", "loud"], nullable: true }),
  startsAt: field.dateTime({ nullable: true }),
  forum: field.relation({
    nullable: true,
    onDelete: "set null",
    target: () => testForumContentType,
  }),
  category: field.relation({
    nullable: true,
    onDelete: "set null",
    target: () => testCategoryContentType,
  }),
  author: field.user(),
  editors: field.user({ multiple: true }),
  cover: field.file({
    maxBytes: 1024,
    allowedExtensions: [".png"],
    allowedMimeTypes: ["image/png"],
  }),
  seo: field.group({ fields: { heading: field.text({ nullable: true }) } }),
  faq: field.repeatable({
    fields: { question: field.text({ required: true }) },
  }),
  content: field.blocks(),
  board: field.container({ definition: boards }),
};

const ownership = { field: "author" };

const define = (overrides: Record<string, unknown> = {}) =>
  defineContentType({
    id: "test.thread",
    tableName: "test_threads",
    publication: true,
    fields,
    publicApi: { path: "threads", fields: ["title", "slug"] },
    ...overrides,
  } as never);

const write = (publicWrite: unknown) => define({ publicWrite });

describe("publicWrite configuration", () => {
  it("is off unless a content type opts in", () => {
    expect(testPostContentType.publicWrite).toMatchObject({
      create: { enabled: false, fields: [] },
      enabled: false,
      ownerField: null,
      update: { enabled: false, fields: [] },
    });
  });

  it("resolves a valid definition with its defaults", () => {
    const { publicWrite } = write({
      ownership,
      create: {
        fields: [
          "title",
          "handle",
          "excerpt",
          "body",
          "rating",
          "closed",
          "mood",
          "startsAt",
          "forum",
        ],
      },
      update: { fields: ["title"] },
    });

    expect(publicWrite).toEqual({
      create: {
        captcha: false,
        enabled: true,
        fields: [
          "title",
          "handle",
          "excerpt",
          "body",
          "rating",
          "closed",
          "mood",
          "startsAt",
          "forum",
        ],
        status: "draft",
      },
      enabled: true,
      ownerField: "author",
      update: { enabled: true, fields: ["title"], own: true },
    });
  });

  it("keeps an explicit status, captcha and own", () => {
    const { publicWrite } = write({
      ownership,
      create: {
        captcha: true,
        fields: ["title", "handle"],
        status: "published",
      },
      update: { fields: ["title"], own: false },
    });

    expect(publicWrite.create).toMatchObject({
      captcha: true,
      status: "published",
    });
    expect(publicWrite.update.own).toBe(false);
  });

  it.each([
    ["create", { ownership, create: false, update: { fields: ["title"] } }],
    [
      "update",
      { ownership, create: { fields: ["title", "handle"] }, update: false },
    ],
  ])("treats %s: false as off", (block, publicWrite) => {
    const resolved = write(publicWrite).publicWrite;

    expect(resolved[block as "create" | "update"].enabled).toBe(false);
    expect(resolved.enabled).toBe(true);
  });

  it.each([
    [
      "an unknown field",
      { ownership, create: { fields: ["title", "nope"] } },
      /unknown field "nope"/,
    ],
    [
      "a field listed twice",
      { ownership, create: { fields: ["title", "title"] } },
      /lists "title" twice/,
    ],
    [
      "an empty allowlist",
      { ownership, update: { fields: [] } },
      /is empty. There is no wildcard/,
    ],
    ...["id", "status", "publishedAt", "version", "hiddenAt", "createdAt"].map(
      name => [
        `the reserved field ${name}`,
        { ownership, update: { fields: [name] } },
        new RegExp(`"${name}", which the server manages`),
      ],
    ),
    [
      "the ownership field",
      { ownership, update: { fields: ["author"] } },
      /ownership field "author"/,
    ],
    [
      "a leaf path",
      { ownership, update: { fields: ["seo.heading"] } },
      /leaf path "seo.heading"/,
    ],
    ...[
      ["file", "cover"],
      ["user", "editors"],
      ["group", "seo"],
      ["repeatable", "faq"],
      ["blocks", "content"],
    ].map(([kind, name]) => [
      `a ${kind} field`,
      { ownership, update: { fields: [name] } },
      new RegExp(`"${name}" of kind "${kind}", which cannot be written`),
    ]),
    [
      "the container field in update",
      { ownership, update: { fields: ["title", "board"] } },
      /update.fields includes the container field "board"/,
    ],
    [
      "a slug derived from another field",
      { ownership, update: { fields: ["slug"] } },
      /slug "slug", which is derived from "title"/,
    ],
    [
      "a relation to a content type without a public API",
      { ownership, update: { fields: ["category"] } },
      /relation "category", but its target "test.category" has no public API/,
    ],
    [
      "a create that leaves out a required field",
      { ownership, create: { fields: ["excerpt"] } },
      /leaves out "title", which every new record needs/,
    ],
    [
      "a missing ownership",
      { update: { fields: ["title"] } },
      /ownership is required/,
    ],
    [
      "an ownership field that does not exist",
      { ownership: { field: "nope" }, update: { fields: ["title"] } },
      /ownership.field references unknown field "nope"/,
    ],
    ...["editors", "title"].map(name => [
      `an ownership field "${name}" that is not a single user`,
      { ownership: { field: name }, update: { fields: ["title"] } },
      new RegExp(`"${name}" must be a single, shared \`field.user\\(\\)\``),
    ]),
    ["a block that enables nothing", { ownership }, /enables nothing/],
    [
      "both blocks switched off",
      { ownership, create: false, update: false },
      /enables nothing/,
    ],
    [
      "delete",
      { ownership, delete: true, update: { fields: ["title"] } },
      /publicWrite.delete is not supported/,
    ],
    [
      "permissions",
      { ownership, permissions: [], update: { fields: ["title"] } },
      /publicWrite.permissions is not an option/,
    ],
    [
      "ownership.assignOnCreate",
      {
        ownership: { assignOnCreate: true, field: "author" },
        update: { fields: ["title"] },
      },
      /assignOnCreate is not an option/,
    ],
    [
      "create.permission",
      { ownership, create: { fields: ["title", "handle"], permission: "x" } },
      /create.permission is not an option/,
    ],
    [
      "an unknown status",
      {
        ownership,
        create: { fields: ["title", "handle"], status: "archived" },
      },
      /create.status is "archived"/,
    ],
    [
      "a captcha that is not a boolean",
      { ownership, create: { captcha: "yes", fields: ["title", "handle"] } },
      /captcha is `true` or `false`/,
    ],
    [
      "an own that is not a boolean",
      { ownership, update: { fields: ["title"], own: "yes" } },
      /own is `true` or `false`/,
    ],
  ] as [string, unknown, RegExp][])(
    "rejects %s",
    (_label, publicWrite, message) => {
      expect(() => write(publicWrite)).toThrow(ContentEngineError);
      expect(() => write(publicWrite)).toThrow(message);
    },
  );

  it("lets a member pick the container on create", () => {
    const definition = define({
      publicApi: {
        path: "threads",
        fields: ["title", "slug", "board"],
        filterableFields: ["board"],
      },
      publicWrite: {
        ownership,
        create: { fields: ["title", "handle", "board"] },
      },
    });

    expect(definition.publicWrite.create.fields).toEqual([
      "title",
      "handle",
      "board",
    ]);
    expect(definition.publicApi.filterableFields).toEqual(["board"]);
  });

  it("needs a public API", () => {
    expect(() =>
      define({
        publicApi: undefined,
        publicWrite: { ownership, update: { fields: ["title"] } },
      }),
    ).toThrow(/publicWrite needs `publicApi`/);
  });

  it("is not available on a localized content type", () => {
    expect(() =>
      defineContentType({
        id: "test.localized-thread",
        tableName: "test_localized_threads",
        publication: true,
        localization: { defaultLocale: "en", fallback: "default" },
        fields: {
          title: field.text({ localized: true, required: true }),
          slug: field.slug({ localized: true, source: "title" }),
          author: field.user(),
        },
        publicApi: { path: "localized-threads", fields: ["title", "slug"] },
        publicWrite: { ownership, update: { fields: ["title"] } },
      } as never),
    ).toThrow(/not available on a localized content type/);
  });
});
