// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { RichTextDocument, RichTextNode } from "./document";

import { sanitizeRichTextHref } from "./elements";
import { richTextToHtml } from "./html";
import { richTextToPlainText } from "./plain-text";

const text = (value: string, marks?: RichTextNode["marks"]): RichTextNode =>
  marks ? { marks, text: value, type: "text" } : { text: value, type: "text" };

const p = (...content: RichTextNode[]): RichTextNode => ({
  content,
  type: "paragraph",
});

const doc = (...content: RichTextNode[]): RichTextDocument => ({
  content,
  type: "doc",
});

describe("richTextToPlainText", () => {
  it("puts every block on its own line and runs inline content on", () => {
    expect(
      richTextToPlainText(
        doc(
          {
            attrs: { level: 2 },
            content: [text("Why")],
            type: "heading",
          },
          p(
            text("We rebuilt "),
            text("the AdminCP", [{ type: "bold" }]),
            text("."),
          ),
          p(),
          {
            content: [
              { content: [p(text("One"))], type: "listItem" },
              { content: [p(text("Two"))], type: "listItem" },
            ],
            type: "bulletList",
          },
        ),
      ),
    ).toBe("Why\nWe rebuilt the AdminCP.\nOne\nTwo");
  });

  it("keeps a hard break and puts table cells side by side", () => {
    expect(
      richTextToPlainText(
        doc(p(text("a"), { type: "hardBreak" }, text("b")), {
          content: [
            {
              content: [
                { content: [p(text("Name"))], type: "tableHeader" },
                { content: [p(text("Role"))], type: "tableHeader" },
              ],
              type: "tableRow",
            },
          ],
          type: "table",
        }),
      ),
    ).toBe("a\nb\nName Role");
  });

  it("reads an emoji as its glyph, or its shortcode without one", () => {
    expect(
      richTextToPlainText(
        doc(
          p(
            text("Hi "),
            { attrs: { emoji: "😄", name: "smile" }, type: "emoji" },
            text(" "),
            { attrs: { name: "party_parrot" }, type: "emoji" },
          ),
        ),
      ),
    ).toBe("Hi 😄 :party_parrot:");
  });

  it("is empty for nothing", () => {
    expect(richTextToPlainText(null)).toBe("");
    expect(richTextToPlainText({ type: "doc" })).toBe("");
  });

  it("never returns markup or entities", () => {
    expect(richTextToPlainText(doc(p(text("1 < 2 & <b>"))))).toBe(
      "1 < 2 & <b>",
    );
  });
});

describe("richTextToHtml", () => {
  it("escapes text and attribute values", () => {
    expect(
      richTextToHtml(
        doc(
          p(
            text('<img src=x onerror="alert(1)">', [
              { attrs: { href: 'https://a.test/?q="x"&y' }, type: "link" },
            ]),
          ),
        ),
      ),
    ).toBe(
      '<p><a href="https://a.test/?q=&quot;x&quot;&amp;y">&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</a></p>',
    );
  });

  it("drops a link to javascript: but keeps its text", () => {
    expect(
      richTextToHtml(
        doc(
          p(
            text("click", [
              { attrs: { href: "javascript:alert(1)" }, type: "link" },
            ]),
          ),
        ),
      ),
    ).toBe("<p>click</p>");
  });

  it("nests marks with the first one outermost", () => {
    expect(
      richTextToHtml(doc(p(text("x", [{ type: "bold" }, { type: "italic" }])))),
    ).toBe("<p><strong><em>x</em></strong></p>");
  });

  it("writes the classes and data attributes the editor parses back", () => {
    expect(
      richTextToHtml(
        doc(
          {
            attrs: { kind: "warning" },
            content: [p(text("Careful"))],
            type: "panel",
          },
          {
            content: [
              {
                attrs: { checked: true },
                content: [p(text("Ship it"))],
                type: "taskItem",
              },
            ],
            type: "taskList",
          },
        ),
      ),
    ).toBe(
      '<div class="tiptap-panel" data-panel="warning"><p>Careful</p></div>' +
        '<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input aria-label="Ship it" checked disabled type="checkbox"><span></span></label><div><p>Ship it</p></div></li></ul>',
    );
  });

  it("keeps only allowlisted styles", () => {
    expect(
      richTextToHtml(
        doc({
          attrs: { textAlign: "center" },
          content: [
            text("a", [
              {
                attrs: { color: "red; background: url(x)", fontSize: "18px" },
                type: "textStyle",
              },
            ]),
          ],
          type: "paragraph",
        }),
      ),
    ).toBe(
      '<p style="text-align: center"><span style="font-size: 18px">a</span></p>',
    );
  });

  it("renders the children of a node it does not know", () => {
    expect(
      richTextToHtml(doc({ content: [p(text("kept"))], type: "spoiler" })),
    ).toBe("<p>kept</p>");
  });
});

describe("sanitizeRichTextHref", () => {
  it.each([
    "https://vitnode.com",
    "http://vitnode.com/a?b=c",
    "mailto:hi@vitnode.com",
    "tel:+48123",
    "/docs",
    "docs/page",
    "#section",
    "//cdn.vitnode.com/a",
  ])("keeps %s", href => {
    expect(sanitizeRichTextHref(href)).toBe(href);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "",
  ])("refuses %j", href => {
    expect(sanitizeRichTextHref(href)).toBeNull();
  });
});
