import { describe, expect, it } from "vitest";

import { autoTranslateFingerprint } from "./source-hash";

const linkDoc = (href: string, text = "the docs") => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Read " },
        {
          type: "text",
          text,
          marks: [{ type: "link", attrs: { href, target: "_blank" } }],
        },
      ],
    },
  ],
});

const fingerprint = (value: unknown, field = "body") =>
  autoTranslateFingerprint({ field, value });

describe("autoTranslateFingerprint", () => {
  it("is a SHA-256 hex digest that ignores key order and undefined keys", () => {
    const a = fingerprint({
      type: "doc",
      content: [{ type: "text", text: "Hi", marks: undefined }],
    });
    const b = fingerprint({
      content: [{ text: "Hi", type: "text" }],
      type: "doc",
    });

    expect(a).toMatch(/^[0-9a-f]{64}$/u);
    expect(a).toBe(b);
  });

  it.each([
    ["the text", linkDoc("https://a.example", "the guide")],
    ["a link target", linkDoc("https://b.example")],
    [
      "a mark",
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Read " },
              { type: "text", text: "the docs", marks: [{ type: "bold" }] },
            ],
          },
        ],
      },
    ],
  ])("changes with %s", (_what, changed) => {
    expect(fingerprint(changed)).not.toBe(
      fingerprint(linkDoc("https://a.example")),
    );
  });

  it("keys the value by its field and source locale", () => {
    expect(fingerprint("Same text", "title")).not.toBe(
      fingerprint("Same text", "body"),
    );
    expect(
      autoTranslateFingerprint({
        field: "body",
        sourceLocale: "pl",
        value: "Same text",
      }),
    ).not.toBe(fingerprint("Same text"));
  });
});
