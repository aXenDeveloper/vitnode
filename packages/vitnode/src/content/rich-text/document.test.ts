// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { RichTextDocument, RichTextNode } from "./document";

import {
  createRichTextDocumentSchema,
  isRichTextEmpty,
  RICH_TEXT_MAX_DEPTH,
  zodRichTextDocument,
} from "./document";

const article: RichTextDocument = {
  content: [
    {
      attrs: { level: 2, textAlign: null },
      content: [{ text: "Why", type: "text" }],
      type: "heading",
    },
    {
      content: [
        { text: "We rebuilt ", type: "text" },
        {
          marks: [
            {
              attrs: { href: "https://vitnode.com", target: "_blank" },
              type: "link",
            },
          ],
          text: "the AdminCP",
          type: "text",
        },
      ],
      type: "paragraph",
    },
    {
      content: [
        {
          content: [
            {
              attrs: { colspan: 1, colwidth: [120], rowspan: 1 },
              content: [{ type: "paragraph" }],
              type: "tableHeader",
            },
          ],
          type: "tableRow",
        },
      ],
      type: "table",
    },
  ],
  type: "doc",
};

const nested = (depth: number): RichTextNode => {
  let node: RichTextNode = { text: "deep", type: "text" };
  for (let level = 0; level < depth; level += 1) {
    node = { content: [node], type: "blockquote" };
  }

  return { content: node.content, type: "doc" };
};

const paragraph = (text: string): RichTextDocument => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

describe("zodRichTextDocument", () => {
  it("accepts what the editor produces", () => {
    expect(zodRichTextDocument.parse(article)).toEqual(article);
  });

  it("accepts an empty document", () => {
    expect(zodRichTextDocument.safeParse({ type: "doc" }).success).toBe(true);
  });

  it.each([
    ["a string", "<p>Hello</p>"],
    ["null", null],
    ["an array", []],
    ["another root", { content: [], type: "paragraph" }],
    ["a node without a type", { content: [{ text: "x" }], type: "doc" }],
    [
      "a type with markup in it",
      { content: [{ type: "<script>" }], type: "doc" },
    ],
    [
      "an unknown key",
      { content: [{ onclick: "alert(1)", type: "paragraph" }], type: "doc" },
    ],
    [
      "an object attribute",
      { attrs: { style: { color: "red" } }, type: "doc" },
    ],
    [
      "text that is not a string",
      { content: [{ text: 42, type: "text" }], type: "doc" },
    ],
    [
      "a mark without a type",
      {
        content: [{ marks: [{ attrs: {} }], text: "x", type: "text" }],
        type: "doc",
      },
    ],
  ])("refuses %s", (_label, value) => {
    expect(zodRichTextDocument.safeParse(value).success).toBe(false);
  });

  it("refuses a document nested past the depth limit", () => {
    expect(
      zodRichTextDocument.safeParse(nested(RICH_TEXT_MAX_DEPTH - 2)).success,
    ).toBe(true);

    const result = zodRichTextDocument.safeParse(nested(RICH_TEXT_MAX_DEPTH));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/deeper than 64/);
  });

  it("measures a thousand levels without walking them recursively", () => {
    expect(zodRichTextDocument.safeParse(nested(5000)).success).toBe(false);
  });

  it("refuses a document larger than maxBytes, counted as UTF-8", () => {
    const schema = createRichTextDocumentSchema({ maxBytes: 200 });

    expect(schema.safeParse(paragraph("a".repeat(60))).success).toBe(true);
    expect(schema.safeParse(paragraph("😀".repeat(30))).success).toBe(false);
  });

  it("defaults to a 1 MB ceiling", () => {
    expect(
      zodRichTextDocument.safeParse(paragraph("a".repeat(1024 * 1024))).success,
    ).toBe(false);
  });

  it("refuses an empty document when required", () => {
    const schema = createRichTextDocumentSchema({ required: true });

    expect(
      schema.safeParse({ content: [{ type: "paragraph" }], type: "doc" })
        .success,
    ).toBe(false);
    expect(schema.safeParse(paragraph("   ")).success).toBe(false);
    expect(schema.safeParse(paragraph("Hello")).success).toBe(true);
  });

  it("can be described as JSON Schema, which AutoForm and OpenAPI need", () => {
    expect(() => z.toJSONSchema(zodRichTextDocument)).not.toThrow();
    expect(z.toJSONSchema(zodRichTextDocument, { io: "input" })).toMatchObject({
      properties: { type: { const: "doc" } },
      type: "object",
    });
  });
});

describe("isRichTextEmpty", () => {
  it.each<[string, null | RichTextDocument]>([
    ["nothing", null],
    ["a bare document", { type: "doc" }],
    ["an empty paragraph", { content: [{ type: "paragraph" }], type: "doc" }],
    ["whitespace", paragraph(" \n ")],
    [
      "an empty list and a rule",
      {
        content: [
          {
            content: [{ content: [{ type: "paragraph" }], type: "listItem" }],
            type: "bulletList",
          },
          { type: "horizontalRule" },
        ],
        type: "doc",
      },
    ],
  ])("is true for %s", (_label, doc) => {
    expect(isRichTextEmpty(doc)).toBe(true);
  });

  it.each<[string, RichTextDocument]>([
    ["text", paragraph("Hi")],
    [
      "an emoji",
      {
        content: [
          {
            content: [{ attrs: { name: "smile" }, type: "emoji" }],
            type: "paragraph",
          },
        ],
        type: "doc",
      },
    ],
    [
      "an audio clip",
      {
        content: [{ attrs: { src: "/a.mp3" }, type: "audio" }],
        type: "doc",
      },
    ],
  ])("is false for %s", (_label, doc) => {
    expect(isRichTextEmpty(doc)).toBe(false);
  });
});
