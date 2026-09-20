import { describe, expect, it } from "vitest";

import {
  clipboardPlainText,
  domInlineText,
  elementText,
  normalizeInlinePaste,
} from "./plain-text";

const NO_BREAK_SPACE = String.fromCodePoint(160);

describe("what a paste is allowed to leave in an inline field", () => {
  it("collapses a multi-line clipboard onto one line for a text field", () => {
    expect(normalizeInlinePaste("text", "  Hello\r\nthere \n  world  ")).toBe(
      "Hello there world",
    );
  });

  it("keeps the line breaks for a textarea field", () => {
    expect(normalizeInlinePaste("textarea", "Hello\r\nthere\n\nworld")).toBe(
      "Hello\nthere\n\nworld",
    );
  });

  it("reads the clipboard as plain text and never as HTML", () => {
    const asked: string[] = [];

    const text = clipboardPlainText("text", {
      getData: (format: string) => {
        asked.push(format);

        return format === "text/plain" ? "Hello" : "<strong>Hello</strong>";
      },
    });

    expect(text).toBe("Hello");
    expect(asked).toStrictEqual(["text/plain"]);
  });

  it("has nothing to insert when there is no clipboard at all", () => {
    expect(clipboardPlainText("text", null)).toBe("");
  });
});

describe("the text an inline field reads back out of its element", () => {
  it("falls back to textContent where innerText does not exist", () => {
    expect(elementText({ textContent: "Written" })).toBe("Written");
  });

  it("prefers innerText where the browser provides it", () => {
    expect(
      elementText({ innerText: "Rendered", textContent: "Rendered  spaced" }),
    ).toBe("Rendered");
  });

  it("never lets a line break into a text field", () => {
    expect(domInlineText("text", { textContent: "Hello\nthere" })).toBe(
      "Hello there",
    );
  });

  it("keeps the line breaks of a textarea field", () => {
    expect(domInlineText("textarea", { textContent: "Hello\r\nthere" })).toBe(
      "Hello\nthere",
    );
  });

  it("turns the space contentEditable types into an ordinary one", () => {
    expect(
      domInlineText("text", { textContent: `Hello${NO_BREAK_SPACE}` }),
    ).toBe("Hello ");
  });
});
