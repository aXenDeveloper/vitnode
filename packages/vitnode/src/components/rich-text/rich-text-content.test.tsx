// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  RichTextDocument,
  RichTextMark,
  RichTextNode,
} from "@/content/rich-text/document";

import { RichTextContent } from "./rich-text-content";

const text = (value: string, marks?: RichTextMark[]): RichTextNode =>
  marks ? { marks, text: value, type: "text" } : { text: value, type: "text" };

const p = (...content: RichTextNode[]): RichTextNode => ({
  content,
  type: "paragraph",
});

const doc = (...content: RichTextNode[]): RichTextDocument => ({
  content,
  type: "doc",
});

const renderDoc = (content: RichTextDocument) =>
  render(<RichTextContent content={content} />).container;

const textOf = (element: Element | null | undefined) =>
  element?.textContent ?? null;

describe("RichTextContent", () => {
  it("renders nothing without a document", () => {
    const { container } = render(<RichTextContent content={null} />);

    expect(container.childElementCount).toBe(0);
  });

  it("renders headings at their level, with a safe alignment", () => {
    renderDoc(
      doc(
        { attrs: { level: 3 }, content: [text("Setup")], type: "heading" },
        {
          attrs: { level: 9, textAlign: "center" },
          content: [text("Fallback")],
          type: "heading",
        },
        {
          attrs: { textAlign: "expression(alert(1))" },
          content: [text("Plain")],
          type: "paragraph",
        },
      ),
    );

    expect(textOf(screen.getByRole("heading", { level: 3 }))).toBe("Setup");
    expect(screen.getByRole("heading", { level: 2 }).style.textAlign).toBe(
      "center",
    );
    expect(screen.getByText("Plain").getAttribute("style")).toBeNull();
  });

  it("renders every inline mark as its element", () => {
    const container = renderDoc(
      doc(
        p(
          text("bold", [{ type: "bold" }]),
          text("italic", [{ type: "italic" }]),
          text("strike", [{ type: "strike" }]),
          text("code", [{ type: "code" }]),
          text("underline", [{ type: "underline" }]),
          text("both", [{ type: "bold" }, { type: "italic" }]),
        ),
      ),
    );

    expect(textOf(container.querySelector("p > strong"))).toBe("bold");
    expect(textOf(container.querySelector("p > em"))).toBe("italic");
    expect(textOf(container.querySelector("s"))).toBe("strike");
    expect(textOf(container.querySelector("code"))).toBe("code");
    expect(textOf(container.querySelector("u"))).toBe("underline");
    expect(textOf(container.querySelector("strong > em"))).toBe("both");
  });

  it("renders text color and size, and drops unsafe values", () => {
    const container = renderDoc(
      doc(
        p(
          text("red", [
            {
              attrs: { color: "#ff0000", fontSize: "18px" },
              type: "textStyle",
            },
          ]),
          text("evil", [
            {
              attrs: { color: "red;background:url(x)", fontSize: "1e9px" },
              type: "textStyle",
            },
          ]),
        ),
      ),
    );

    const styled = screen.getByText("red");
    expect(styled.style.color).toBe("rgb(255, 0, 0)");
    expect(styled.style.fontSize).toBe("18px");
    expect(screen.getByText("evil", { exact: false }).tagName).toBe("P");
    expect(container.querySelectorAll("span")).toHaveLength(1);
  });

  it("renders links, opening a new tab safely", () => {
    renderDoc(
      doc(
        p(
          text("docs", [{ attrs: { href: "/docs" }, type: "link" }]),
          text("site", [
            {
              attrs: { href: "https://vitnode.com", target: "_blank" },
              type: "link",
            },
          ]),
        ),
      ),
    );

    const internal = screen.getByRole("link", { name: "docs" });
    expect(internal.getAttribute("href")).toBe("/docs");
    expect(internal.hasAttribute("target")).toBe(false);

    const external = screen.getByRole("link", { name: "site" });
    expect(external.getAttribute("target")).toBe("_blank");
    expect(external.getAttribute("rel")).toBe("noopener noreferrer nofollow");
  });

  it.each([
    "javascript:alert(1)",
    "  JAVASCRIPT:alert(1)",
    "java\nscript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox(1)",
  ])("renders a link to %j as plain text", href => {
    renderDoc(doc(p(text("click me", [{ attrs: { href }, type: "link" }]))));

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("click me").tagName).toBe("P");
  });

  it("renders lists, keeping an ordered list's start", () => {
    renderDoc(
      doc(
        {
          content: [{ content: [p(text("Bullet"))], type: "listItem" }],
          type: "bulletList",
        },
        {
          attrs: { start: 3 },
          content: [
            { content: [p(text("Third"))], type: "listItem" },
            { content: [p(text("Fourth"))], type: "listItem" },
          ],
          type: "orderedList",
        },
      ),
    );

    const [bullets, numbered] = screen.getAllByRole("list");
    expect(bullets.tagName).toBe("UL");
    expect(textOf(within(bullets).getByRole("listitem"))).toBe("Bullet");
    expect(numbered.tagName).toBe("OL");
    expect(numbered.getAttribute("start")).toBe("3");
    expect(within(numbered).getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders blocks: quote, code, rule and a hard break", () => {
    const container = renderDoc(
      doc(
        { content: [p(text("Quoted"))], type: "blockquote" },
        {
          attrs: { language: "ts" },
          content: [text("const a = 1;")],
          type: "codeBlock",
        },
        {
          attrs: { language: '"><script>' },
          content: [text("plain")],
          type: "codeBlock",
        },
        { type: "horizontalRule" },
        p(text("line"), { type: "hardBreak" }, text("next")),
      ),
    );

    expect(textOf(container.querySelector("blockquote"))).toBe("Quoted");
    const [typed, untyped] = container.querySelectorAll("pre > code");
    expect(textOf(typed)).toBe("const a = 1;");
    expect(typed.getAttribute("class")).toBe("language-ts");
    expect(untyped.hasAttribute("class")).toBe(false);
    expect(screen.getByRole("separator").tagName).toBe("HR");
    expect(container.querySelector("p br")).not.toBeNull();
  });

  it("renders a table with header cells and spans", () => {
    renderDoc(
      doc({
        content: [
          {
            content: [
              {
                attrs: { colspan: 2, colwidth: [100, 200], rowspan: 1 },
                content: [p(text("Name"))],
                type: "tableHeader",
              },
            ],
            type: "tableRow",
          },
          {
            content: [
              { content: [p(text("Ada"))], type: "tableCell" },
              {
                attrs: { colspan: 1, rowspan: 2 },
                content: [p(text("Admin"))],
                type: "tableCell",
              },
            ],
            type: "tableRow",
          },
        ],
        type: "table",
      }),
    );

    const table = screen.getByRole("table");
    expect(
      screen
        .getByRole("columnheader", { name: "Name" })
        .getAttribute("colspan"),
    ).toBe("2");
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(
      screen.getByRole("cell", { name: "Admin" }).getAttribute("rowspan"),
    ).toBe("2");
    expect(
      [...table.querySelectorAll("col")].map(col => col.style.width),
    ).toEqual(["100px", "200px"]);
  });

  it("renders a task as a disabled checkbox named after its text", () => {
    renderDoc(
      doc({
        content: [
          {
            attrs: { checked: true },
            content: [p(text("Write the docs"))],
            type: "taskItem",
          },
          {
            attrs: { checked: false },
            content: [p(text("Ship"))],
            type: "taskItem",
          },
        ],
        type: "taskList",
      }),
    );

    const done = screen.getByRole<HTMLInputElement>("checkbox", {
      name: "Write the docs",
    });
    expect(done.checked).toBe(true);
    expect(done.disabled).toBe(true);
    expect(
      screen.getByRole<HTMLInputElement>("checkbox", { name: "Ship" }).checked,
    ).toBe(false);
  });

  it("renders a panel of a known kind only", () => {
    const container = renderDoc(
      doc(
        {
          attrs: { kind: "warning" },
          content: [p(text("Careful"))],
          type: "panel",
        },
        {
          attrs: { kind: "javascript" },
          content: [p(text("Odd"))],
          type: "panel",
        },
      ),
    );

    const [warning, fallback] = container.querySelectorAll("[data-panel]");
    expect(warning.getAttribute("data-panel")).toBe("warning");
    expect(textOf(warning)).toBe("Careful");
    expect(fallback.getAttribute("data-panel")).toBe("info");
  });

  it("renders audio from a safe source only", () => {
    const container = renderDoc(
      doc(
        { attrs: { src: "https://cdn.test/a.mp3" }, type: "audio" },
        { attrs: { src: "javascript:alert(1)" }, type: "audio" },
        { attrs: { src: "data:audio/mp3;base64,AAAA" }, type: "audio" },
      ),
    );

    const audio = container.querySelectorAll("audio");
    expect(audio).toHaveLength(1);
    expect(audio[0].getAttribute("src")).toBe("https://cdn.test/a.mp3");
    expect(audio[0].hasAttribute("controls")).toBe(true);
  });

  it("renders an emoji as its glyph, its image, or its shortcode", () => {
    renderDoc(
      doc(
        p(
          { attrs: { emoji: "😄", name: "smile" }, type: "emoji" },
          {
            attrs: { name: "parrot", src: "/emoji/parrot.gif" },
            type: "emoji",
          },
          { attrs: { name: "unknown" }, type: "emoji" },
        ),
      ),
    );

    expect(screen.getByText("😄").getAttribute("data-name")).toBe("smile");
    expect(
      screen.getByRole("img", { name: ":parrot:" }).getAttribute("src"),
    ).toBe("/emoji/parrot.gif");
    expect(screen.getByText(":unknown:").tagName).toBe("SPAN");
  });

  it("renders the content of an unknown node and the text of an unknown mark", () => {
    const container = renderDoc(
      doc({
        content: [p(text("Hidden", [{ type: "sparkle" }]))],
        type: "spoiler",
      }),
    );

    expect(screen.getByText("Hidden").tagName).toBe("P");
    expect(container.querySelector(".tiptap > p")).not.toBeNull();
  });

  it("lets a plugin replace or add renderers", () => {
    render(
      <RichTextContent
        content={doc(
          { content: [p(text("Secret"))], type: "spoiler" },
          p(text("@ada", [{ attrs: { id: 7 }, type: "mention" }])),
          { attrs: { level: 2 }, content: [text("Title")], type: "heading" },
        )}
        marks={{
          mention: ({ children, mark }) => (
            <a href={`/profile/${String(mark.attrs?.id)}`}>{children}</a>
          ),
        }}
        nodes={{
          heading: ({ children }) => <h5>{children}</h5>,
          spoiler: ({ children }) => (
            <details>
              <summary>Spoiler</summary>
              {children}
            </details>
          ),
        }}
      />,
    );

    expect(textOf(screen.getByText("Spoiler").closest("details"))).toBe(
      "SpoilerSecret",
    );
    expect(
      screen.getByRole("link", { name: "@ada" }).getAttribute("href"),
    ).toBe("/profile/7");
    expect(textOf(screen.getByRole("heading", { level: 5 }))).toBe("Title");
  });
});
