// @vitest-environment node
import { describe, expect, it } from "vitest";

import { CONTENT_RICH_TEXT_MAX_HTML_LENGTH } from "../const";
import { field } from "../fields";
import { normalizeContentRichText } from "./rich-text";

const required = field.richText({ required: true });
const optional = field.richText({ defaultValue: "" });
const nullable = field.richText({ nullable: true });

const valueOf = (result: ReturnType<typeof normalizeContentRichText>) => {
  if (!result.ok) throw new Error(result.issue);

  return result.value;
};

describe("normalizeContentRichText", () => {
  it.each([
    ["<p>Hi<script>alert(1)</script></p>", "<p>Hi</p>"],
    ['<p onclick="x()" onmouseover="y()">Hi</p>', "<p>Hi</p>"],
    ['<a href="javascript:alert(1)">Hi</a>', "<a>Hi</a>"],
    ['<a href="JaVaScRiPt:alert(1)">Hi</a>', "<a>Hi</a>"],
    ['<p>Hi<img src="data:image/svg+xml;base64,AAAA"></p>', "<p>Hi<img /></p>"],
    ['<p>Hi<iframe src="https://evil.test"></iframe></p>', "<p>Hi</p>"],
  ])("sanitises %s", (input, expected) => {
    expect(valueOf(normalizeContentRichText(required, input))).toBe(expected);
  });

  it.each([
    "<script>alert(1)</script>",
    '<img src="javascript:alert(1)">',
    '<img src="data:image/png;base64,AAAA">',
    '<p onclick="x()"></p>',
  ])("refuses %s as a required value once it is sanitised", input => {
    expect(normalizeContentRichText(required, input)).toMatchObject({
      ok: false,
    });
  });

  it.each([
    "<p></p>",
    "<p> </p>",
    "<p><br></p>",
    "<strong></strong>",
    "&nbsp;",
  ])("stores %j as nothing", input => {
    expect(valueOf(normalizeContentRichText(optional, input))).toBe("");
    expect(valueOf(normalizeContentRichText(nullable, input))).toBeNull();
    expect(normalizeContentRichText(required, input).ok).toBe(false);
  });

  it("keeps media-only content", () => {
    expect(
      valueOf(
        normalizeContentRichText(
          required,
          '<p><img src="https://example.com/a.png" alt=""></p>',
        ),
      ),
    ).toBe('<p><img src="https://example.com/a.png" alt="" /></p>');
  });

  it("measures length on plain text, not markup", () => {
    const bounded = field.richText({ maxLength: 5, minLength: 2 });
    const styled = '<p><span style="color:red">Hello</span></p>';

    expect(valueOf(normalizeContentRichText(bounded, styled))).toBe(styled);
    expect(normalizeContentRichText(bounded, "<p>Hello!</p>").ok).toBe(false);
    expect(normalizeContentRichText(bounded, "<p>H</p>").ok).toBe(false);
  });

  it("refuses HTML past the size limit before sanitising it", () => {
    const html = `<p>${"a".repeat(CONTENT_RICH_TEXT_MAX_HTML_LENGTH)}</p>`;

    expect(normalizeContentRichText(optional, html)).toMatchObject({
      ok: false,
    });
  });
});
