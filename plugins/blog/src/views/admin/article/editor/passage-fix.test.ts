import type {
  RichTextDocument,
  RichTextNode,
} from "@vitnode/core/content/rich-text";

import { describe, expect, it } from "vitest";

import { applyPassageFix } from "./passage-fix";

const doc = (...content: RichTextNode[]): RichTextDocument => ({
  content,
  type: "doc",
});

const paragraph = (
  ...content: { marks?: { type: string }[]; text?: string; type: string }[]
) => ({
  content,
  type: "paragraph",
});

const text = (value: string, marks?: { type: string }[]) =>
  marks ? { marks, text: value, type: "text" } : { text: value, type: "text" };

describe("applyPassageFix", () => {
  it("replaces a passage inside one text node", () => {
    const result = applyPassageFix(
      doc(paragraph(text("Do not read this. It is a test."))),
      { quote: "Do not read this.", replacement: "Read this." },
    );

    expect(result).toEqual(doc(paragraph(text("Read this. It is a test."))));
  });

  it("keeps the formatting around a passage that spans marked text", () => {
    const result = applyPassageFix(
      doc(
        paragraph(
          text("Start "),
          text("bold words", [{ type: "bold" }]),
          text(" end."),
        ),
      ),
      { quote: "Start bold", replacement: "Opening" },
    );

    expect(result).toEqual(
      doc(
        paragraph(
          text("Opening"),
          text(" words", [{ type: "bold" }]),
          text(" end."),
        ),
      ),
    );
  });

  it("matches a quote whose whitespace the model collapsed", () => {
    const result = applyPassageFix(
      doc(paragraph(text("HELLO-FROM-A  HELLO-FROM-B aa"))),
      { quote: "HELLO-FROM-A HELLO-FROM-B", replacement: "Hello" },
    );

    expect(result).toEqual(doc(paragraph(text("Hello aa"))));
  });

  it("removes a paragraph the fix deletes entirely", () => {
    const result = applyPassageFix(
      doc(paragraph(text("Keep me.")), paragraph(text("wow xdd"))),
      { quote: "wow xdd", replacement: "" },
    );

    expect(result).toEqual(doc(paragraph(text("Keep me."))));
  });

  it("leaves an empty paragraph when the only text is deleted", () => {
    const result = applyPassageFix(doc(paragraph(text("wow xdd"))), {
      quote: "wow xdd",
      replacement: "",
    });

    expect(result).toEqual(doc({ type: "paragraph" }));
  });

  it("finds a passage nested inside a list", () => {
    const result = applyPassageFix(
      doc({
        content: [
          { content: [paragraph(text("First item"))], type: "listItem" },
        ],
        type: "bulletList",
      }),
      { quote: "First", replacement: "Only" },
    );

    expect(result?.content?.[0]?.content?.[0]?.content?.[0]).toEqual(
      paragraph(text("Only item")),
    );
  });

  it("does not match across an inline atom", () => {
    const result = applyPassageFix(
      doc(paragraph(text("Hello "), { type: "hardBreak" }, text("world"))),
      { quote: "Hello world", replacement: "Hi" },
    );

    expect(result).toBeNull();
  });

  it("returns null when the passage is not in the article", () => {
    expect(
      applyPassageFix(doc(paragraph(text("Something else."))), {
        quote: "Not here",
        replacement: "x",
      }),
    ).toBeNull();
    expect(applyPassageFix(null, { quote: "x", replacement: "y" })).toBeNull();
  });

  it("flattens line breaks in the replacement into one paragraph", () => {
    const result = applyPassageFix(doc(paragraph(text("One. Two."))), {
      quote: "One.",
      replacement: "First line.\n\nSecond line.",
    });

    expect(result).toEqual(
      doc(paragraph(text("First line. Second line. Two."))),
    );
  });
});
