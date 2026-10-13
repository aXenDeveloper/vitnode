import { describe, expect, it } from "vitest";

import { testCategoryContentType } from "@/tests/content-fixtures";

import { ContentEngineError } from "../errors";
import { field } from "../fields";
import { defineContentContainer } from "./define";

const define = (overrides: Record<string, unknown> = {}) =>
  defineContentContainer({ id: "test.boards", ...overrides });

const boards = defineContentContainer({
  id: "test.boards",
  fields: {
    description: field.textarea({ maxLength: 20, nullable: true }),
    color: field.text({ maxLength: 7, required: true }),
    locked: field.boolean({ defaultValue: false }),
    secret: field.text({ nullable: true }),
  },
  publicApi: { path: "boards", fields: ["description", "color"] },
});

describe("defineContentContainer", () => {
  describe("a valid definition", () => {
    it("resolves the defaults", () => {
      const definition = defineContentContainer({ id: "example.kb.sections" });

      expect(definition).toMatchObject({
        admin: {
          navigation: { enabled: true },
          path: "example/kb/sections",
          permissionModule: "example_kb_sections",
        },
        fields: {},
        hierarchy: { enabled: true, maxDepth: 5 },
        id: "example.kb.sections",
        kind: "contentContainer",
        ordering: { mode: "manual" },
        publicApi: { enabled: false, fields: [], path: "" },
      });
    });

    it("snake_cases a dashed id into the permission module", () => {
      expect(define({ id: "test.help-desk" }).admin.permissionModule).toBe(
        "test_help_desk",
      );
    });

    it("keeps explicit options", () => {
      const definition = define({
        admin: {
          navigation: false,
          path: "forum/boards",
          permissionModule: "boards",
        },
        hierarchy: { maxDepth: 3 },
        ordering: { mode: "alphabetical" },
        publicApi: { path: "boards" },
      });

      expect(definition).toMatchObject({
        admin: {
          navigation: { enabled: false },
          path: "forum/boards",
          permissionModule: "boards",
        },
        hierarchy: { enabled: true, maxDepth: 3 },
        ordering: { mode: "alphabetical" },
        publicApi: { enabled: true, fields: [], path: "boards" },
      });
    });

    it("turns a disabled hierarchy into one level", () => {
      expect(define({ hierarchy: { enabled: false } }).hierarchy).toEqual({
        enabled: false,
        maxDepth: 1,
      });
    });

    it("treats publicApi: false as disabled", () => {
      expect(define({ publicApi: false }).publicApi.enabled).toBe(false);
    });

    it("accepts every scalar field kind", () => {
      expect(() =>
        define({
          fields: {
            count: field.number({ integer: true, nullable: true }),
            description: field.textarea({ nullable: true }),
            kind: field.enum({ values: ["a", "b"], defaultValue: "a" }),
            locked: field.boolean({ defaultValue: false }),
            title: field.text({ required: true }),
          },
        }),
      ).not.toThrow();
    });
  });

  describe("errors", () => {
    it.each([
      ["an id without a dot", { id: "boards" }, /must look like/],
      ["an uppercase id", { id: "Test.Boards" }, /must look like/],
      ["an id with a trailing dot", { id: "test." }, /must look like/],
      ["a non-string id", { id: 1 }, /must look like/],
      ["fields that are not an object", { fields: [] }, /fields is an object/],
      [
        "a field name that is not camelCase",
        { fields: { Color: field.text() } },
        /must be camelCase/,
      ],
      ...[
        "name",
        "slug",
        "parentId",
        "position",
        "metadata",
        "depth",
        "children",
      ].map(name => [
        `the reserved field ${name}`,
        { fields: { [name]: field.text() } },
        new RegExp(`Field "${name}" is reserved`),
      ]),
      [
        "a value that is not a field descriptor",
        { fields: { color: "red" } },
        /"color" is not a field descriptor/,
      ],
      ...(
        [
          ["richText", field.richText()],
          [
            "relation",
            field.relation({ target: () => testCategoryContentType }),
          ],
          ["user", field.user()],
          [
            "file",
            field.file({
              allowedExtensions: [".png"],
              allowedMimeTypes: ["image/png"],
              maxBytes: 1024,
            }),
          ],
          ["dateTime", field.dateTime({ nullable: true })],
        ] as [string, unknown][]
      ).map(([kind, descriptor]) => [
        `a ${kind} field`,
        { fields: { extra: descriptor } },
        new RegExp(`"extra" is a "${kind}" field`),
      ]),
      [
        "a localized field",
        { fields: { color: field.text({ localized: true }) } },
        /`localized: true`/,
      ],
      [
        "a unique field",
        { fields: { color: field.text({ unique: true }) } },
        /`unique: true`/,
      ],
      [
        "an AI-assisted field",
        {
          fields: {
            color: field.text({
              ai: { action: "x:y", mode: "suggestion", sourceFields: [] },
            }),
          },
        },
        /AI assist is for content types only/,
      ],
      [
        "minLength greater than maxLength",
        { fields: { color: field.text({ maxLength: 5, minLength: 10 }) } },
        /minLength 10 greater than maxLength 5/,
      ],
      ...[1, 0, 11, 1.5].map(maxDepth => [
        `hierarchy.maxDepth ${maxDepth}`,
        { hierarchy: { maxDepth } },
        /maxDepth must be a whole number from 2 to 10/,
      ]),
      [
        "maxDepth on a disabled hierarchy",
        { hierarchy: { enabled: false, maxDepth: 3 } },
        /maxDepth is set while hierarchy is disabled/,
      ],
      [
        "an unknown hierarchy key",
        { hierarchy: { depth: 3 } },
        /hierarchy.depth is not an option/,
      ],
      [
        "a non-boolean hierarchy.enabled",
        { hierarchy: { enabled: "yes" } },
        /hierarchy.enabled is `true` or `false`/,
      ],
      [
        "an unknown ordering mode",
        { ordering: { mode: "newest" } },
        /ordering.mode must be one of: manual, alphabetical/,
      ],
      [
        "an unknown ordering key",
        { ordering: { direction: "asc" } },
        /ordering.direction is not an option/,
      ],
      [
        "a publicApi path with uppercase letters",
        { publicApi: { path: "Boards" } },
        /publicApi.path "Boards" must be one lowercase URL segment/,
      ],
      [
        "a publicApi path with a slash",
        { publicApi: { path: "forum/boards" } },
        /must be one lowercase URL segment/,
      ],
      [
        "the reserved publicApi path admin",
        { publicApi: { path: "admin" } },
        /publicApi.path "admin" is reserved/,
      ],
      [
        "an unknown publicApi key",
        { publicApi: { path: "boards", filterableFields: [] } },
        /publicApi.filterableFields is not an option/,
      ],
      [
        "an unknown publicApi field",
        { publicApi: { path: "boards", fields: ["nope"] } },
        /publicApi.fields references unknown field "nope"/,
      ],
      [
        "a publicApi field listed twice",
        {
          fields: { color: field.text({ nullable: true }) },
          publicApi: { path: "boards", fields: ["color", "color"] },
        },
        /lists "color" twice/,
      ],
      [
        "a core column in publicApi.fields",
        { publicApi: { path: "boards", fields: ["slug"] } },
        /lists "slug", which every public container already returns/,
      ],
      ...["/forum", "forum/", "forum//boards", "Forum", "forum_boards"].map(
        path => [
          `the admin path ${path}`,
          { admin: { path } },
          /admin.path .* is not a URL path/,
        ],
      ),
      ...["Boards", "1boards", "forum-boards"].map(permissionModule => [
        `the permission module ${permissionModule}`,
        { admin: { permissionModule } },
        /admin.permissionModule .* must be snake_case/,
      ]),
      [
        "an unknown admin key",
        { admin: { title: "Boards" } },
        /admin.title is not an option/,
      ],
    ] as [string, Record<string, unknown>, RegExp][])(
      "rejects %s",
      (_label, overrides, message) => {
        expect(() => define(overrides)).toThrow(ContentEngineError);
        expect(() => define(overrides)).toThrow(message);
      },
    );
  });

  describe("schemas", () => {
    const { schemas } = boards;

    it.each([
      ["a name only", { name: "General" }],
      [
        "every option",
        {
          metadata: { color: "#fff" },
          name: "General",
          parentId: 3,
          position: 0,
          slug: "general",
        },
      ],
      ["a root parent", { name: "General", parentId: null }],
    ])("create accepts %s", (_label, body) => {
      expect(schemas.create.safeParse(body).success).toBe(true);
    });

    it.each([
      ["no name", {}],
      ["a blank name", { name: "   " }],
      ["a name past 255 characters", { name: "a".repeat(256) }],
      ["a slug past 160 characters", { name: "A", slug: "a".repeat(161) }],
      ["a zero parent id", { name: "A", parentId: 0 }],
      ["a negative position", { name: "A", position: -1 }],
      ["a fractional position", { name: "A", position: 1.5 }],
      ["an unknown key", { depth: 2, name: "A" }],
      ["metadata that misses a required field", { metadata: {}, name: "A" }],
    ])("create rejects %s", (_label, body) => {
      expect(schemas.create.safeParse(body).success).toBe(false);
    });

    it.each([
      ["a name", { name: "Renamed" }],
      ["a partial metadata patch", { metadata: { locked: true } }],
    ])("update accepts %s", (_label, body) => {
      expect(schemas.update.safeParse(body).success).toBe(true);
    });

    it.each([
      ["an empty body", {}],
      ["a parent id, which is a move", { parentId: 1 }],
      ["a position, which is a move", { position: 1 }],
      ["an unknown metadata key", { metadata: { nope: 1 } }],
    ])("update rejects %s", (_label, body) => {
      expect(schemas.update.safeParse(body).success).toBe(false);
    });

    it.each([
      ["a root", { parentId: null, position: 0 }, true],
      ["a parent", { parentId: 4, position: 2 }, true],
      ["a missing parent id", { position: 0 }, false],
      ["a missing position", { parentId: null }, false],
      ["a negative position", { parentId: null, position: -1 }, false],
      ["an extra key", { name: "A", parentId: null, position: 0 }, false],
    ])("move with %s", (_label, body, success) => {
      expect(schemas.move.safeParse(body).success).toBe(success);
    });

    it.each([
      ["every field", { color: "#fff", description: "Hi", locked: true }, true],
      ["only the required field", { color: "#fff" }, true],
      ["a null nullable field", { color: "#fff", description: null }, true],
      ["the required field missing", { description: "Hi" }, false],
      ["the required field null", { color: null }, false],
      ["a value past maxLength", { color: "#ffffff00" }, false],
      ["a wrong type", { color: "#fff", locked: "yes" }, false],
      ["an unknown field", { color: "#fff", extra: 1 }, false],
    ])("metadata with %s", (_label, metadata, success) => {
      expect(schemas.metadata.safeParse(metadata).success).toBe(success);
    });

    it("strips non-public metadata from a public record", () => {
      const parsed = schemas.publicRecord.parse({
        depth: 1,
        id: 1,
        metadata: {
          color: "#fff",
          description: null,
          locked: true,
          secret: "s3cret",
        },
        name: "General",
        parentId: null,
        position: 0,
        slug: "general",
      });

      expect(parsed.metadata).toEqual({ color: "#fff", description: null });
    });
  });
});
