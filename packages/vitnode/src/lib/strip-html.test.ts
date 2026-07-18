import { describe, expect, it } from "vitest";

import { stripHtml } from "./strip-html";

describe("stripHtml", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("drops script and style content", () => {
    expect(
      stripHtml("Keep<style>.a{color:red}</style><script>alert(1)</script> me"),
    ).toBe("Keep me");
  });

  it("decodes common entities", () => {
    expect(stripHtml("a &amp; b &lt;c&gt; &nbsp;d")).toBe("a & b <c> d");
  });

  it("returns empty string for tag-only input", () => {
    expect(stripHtml("<br/><hr/>")).toBe("");
  });
});
