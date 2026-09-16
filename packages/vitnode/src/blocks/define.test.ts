// @vitest-environment node
import { describe, expect, it } from "vitest";

import { field } from "../content/fields";
import { defineBlock } from "./define";
import { BlockError } from "./errors";

const Noop = () => null;

describe("defineBlock", () => {
  it("keeps the id it was given, unnamespaced", () => {
    const block = defineBlock({
      component: Noop,
      fields: { title: field.text({ required: true }) },
      id: "latest-posts",
    });

    expect(block.id).toBe("latest-posts");
  });

  it("refuses an id that is already namespaced", () => {
    expect(() =>
      defineBlock({
        component: Noop,
        fields: { title: field.text({ required: true }) },
        id: "blog:latest-posts",
      }),
    ).toThrow(BlockError);
  });

  it("refuses an id that is not lowercase kebab-case", () => {
    expect(() =>
      defineBlock({
        component: Noop,
        fields: { title: field.text() },
        id: "LatestPosts",
      }),
    ).toThrow(/lowercase letters/);
  });

  it("refuses a block with no fields", () => {
    expect(() =>
      defineBlock({ component: Noop, fields: {}, id: "empty" }),
    ).toThrow(/at least one field/);
  });

  it("refuses a field kind a JSON document cannot hold", () => {
    expect(() =>
      defineBlock({
        component: Noop,
        fields: { cover: field.file({ maxBytes: 1024 }) },
        id: "cover",
      }),
    ).toThrow(/Allowed kinds/);
  });

  it("refuses a localized field, and points at the zone instead", () => {
    expect(() =>
      defineBlock({
        component: Noop,
        fields: { title: field.text({ localized: true, required: true }) },
        id: "hero",
      }),
    ).toThrow(/field\.blocks\(\{ localized: true \}\)/);
  });

  it("refuses a disallowed kind nested in a group", () => {
    expect(() =>
      defineBlock({
        component: Noop,
        fields: {
          media: field.group({
            fields: { alt: field.text({ nullable: true }) },
          }),
        },
        id: "media",
      }),
    ).not.toThrow();
  });

  describe("parse", () => {
    const block = defineBlock({
      component: Noop,
      fields: {
        description: field.textarea({ nullable: true }),
        title: field.text({ maxLength: 10, required: true }),
        variant: field.enum({
          defaultValue: "default",
          values: ["default", "centered"],
        }),
      },
      id: "hero",
    });

    it("applies the defaults declared by the fields", () => {
      expect(block.parse({ title: "Build" })).toStrictEqual({
        title: "Build",
        variant: "default",
      });
    });

    it("rejects a value that breaks a field constraint", () => {
      expect(() => block.parse({ title: "far too long to fit" })).toThrow(
        BlockError,
      );
    });

    it("rejects a required field that is missing", () => {
      expect(() => block.parse({})).toThrow(/title/);
    });

    it("rejects keys the block does not declare", () => {
      expect(() => block.parse({ hacked: true, title: "Build" })).toThrow(
        BlockError,
      );
    });
  });
});
