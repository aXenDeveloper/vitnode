import { describe, expect, it } from "vitest";

import type { AutoTranslateSegment } from "./segments";

import {
  applyAutoTranslateSegments,
  AutoTranslateSegmentsError,
  autoTranslateSource,
} from "./segments";

const link = { type: "link", attrs: { href: "https://example.com/guide" } };

const document = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Login is broken" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Hi " },
        { type: "mention", attrs: { id: 7, label: "anna" } },
        { type: "text", text: ", see " },
        { type: "text", text: "the guide", marks: [link] },
        { type: "text", text: " or run " },
        { type: "text", text: "pnpm dev", marks: [{ type: "code" }] },
        { type: "text", text: " and open https://example.com/x now." },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "https://example.com/guide",
          marks: [link],
        },
      ],
    },
    {
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [{ type: "text", text: "const broken = true;" }],
    },
  ],
};

const POLISH: Record<string, string> = {
  s1: "Logowanie nie działa",
  s2: "Cześć",
  s3: ", zobacz",
  s4: "poradnik",
  s5: "lub uruchom",
  s6: "i otwórz ⟦1⟧ teraz.",
};

const translate = (overrides: Record<string, string> = {}) =>
  Object.entries({ ...POLISH, ...overrides }).map(([id, text]) => ({
    id,
    text,
  }));

describe("autoTranslateSource", () => {
  it("sends text runs by block and leaves code, mentions and bare link text out", () => {
    const source = autoTranslateSource(document);

    expect(source.blocks).toEqual([
      { segments: [{ id: "s1", text: "Login is broken" }] },
      {
        segments: [
          { id: "s2", text: "Hi" },
          { id: "s3", text: ", see" },
          { id: "s4", text: "the guide" },
          { id: "s5", text: "or run" },
          { id: "s6", text: "and open ⟦1⟧ now." },
        ],
      },
    ]);
    expect(source.plain).not.toContain("pnpm dev");
    expect(source.plain).not.toContain("const broken");
  });

  it("gives nothing for a missing value", () => {
    expect(autoTranslateSource(null).slots).toEqual([]);
  });
});

describe("applyAutoTranslateSegments", () => {
  it("rebuilds the document, changing only the text that was sent", () => {
    const source = autoTranslateSource(document);

    const result = applyAutoTranslateSegments(document, source, translate());

    expect(result).toEqual({
      ...document,
      content: [
        {
          ...document.content[0],
          content: [{ type: "text", text: "Logowanie nie działa" }],
        },
        {
          ...document.content[1],
          content: [
            { type: "text", text: "Cześć " },
            { type: "mention", attrs: { id: 7, label: "anna" } },
            { type: "text", text: ", zobacz " },
            { type: "text", text: "poradnik", marks: [link] },
            { type: "text", text: " lub uruchom " },
            { type: "text", text: "pnpm dev", marks: [{ type: "code" }] },
            { type: "text", text: " i otwórz https://example.com/x teraz." },
          ],
        },
        ...document.content.slice(2),
      ],
    });
    expect(document.content[0].content[0].text).toBe("Login is broken");
  });

  it.each<[string, AutoTranslateSegment[]]>([
    ["a missing segment", translate().filter(segment => segment.id !== "s4")],
    ["an extra segment", [...translate(), { id: "s7", text: "Dodatkowy" }]],
    [
      "an unknown id in place of a known one",
      [
        ...translate().filter(segment => segment.id !== "s4"),
        { id: "s9", text: "poradnik" },
      ],
    ],
    ["a repeated id", [...translate(), { id: "s1", text: "Znowu" }]],
    ["an empty segment", translate({ s2: "  " })],
    ["a lost placeholder", translate({ s6: "i otwórz link teraz." })],
    ["an invented placeholder", translate({ s5: "lub ⟦2⟧ uruchom" })],
  ])("rejects model output with %s", (_what, segments) => {
    const source = autoTranslateSource(document);

    expect(() =>
      applyAutoTranslateSegments(document, source, segments),
    ).toThrow(AutoTranslateSegmentsError);
  });
});
