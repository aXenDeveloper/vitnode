import { describe, expect, it } from "vitest";

import { analyzeHtml, htmlToText, isHtmlEmpty, stripHtml } from "./strip-html";

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

  it("decodes an entity exactly once", () => {
    expect(stripHtml("&amp;lt;p&amp;gt; &amp;amp;")).toBe("&lt;p&gt; &amp;");
  });

  it("decodes numeric entities and leaves unknown ones alone", () => {
    expect(stripHtml("&#169; &#x1F600; &bogus; &#0;")).toBe(
      "© 😀 &bogus; &#0;",
    );
  });

  it("returns empty string for tag-only input", () => {
    expect(stripHtml("<br/><hr/>")).toBe("");
  });

  it("does not split a word across inline tags", () => {
    expect(stripHtml("<p>wo<strong>rd</strong>s</p>")).toBe("words");
  });

  it("keeps a literal less-than sign", () => {
    expect(stripHtml("<p>a < b</p>")).toBe("a < b");
  });

  it("ignores a closing angle bracket inside a quoted attribute", () => {
    expect(stripHtml('<a title="x > y" href="/">link</a>')).toBe("link");
  });

  it("drops comments and unterminated tags", () => {
    expect(stripHtml("a<!-- hidden -->b<p class=")).toBe("ab");
  });
});

describe("htmlToText", () => {
  it("puts paragraphs, headings and list items on their own lines", () => {
    expect(
      htmlToText(
        "<h2>Title</h2><p>First</p><p>Second</p><ul><li>One</li><li>Two</li></ul>",
      ),
    ).toBe("Title\nFirst\nSecond\nOne\nTwo");
  });

  it("separates table cells with a space and rows with a line", () => {
    expect(
      htmlToText(
        "<table><tbody><tr><td>a</td><td>b</td></tr><tr><th>c</th><td>d</td></tr></tbody></table>",
      ),
    ).toBe("a b\nc d");
  });

  it("turns a line break into a new line", () => {
    expect(htmlToText("<p>one<br>two</p>")).toBe("one\ntwo");
  });

  it("keeps the line breaks of preformatted text", () => {
    expect(htmlToText("<pre><code>a\nb</code></pre>")).toBe("a\nb");
  });

  it("drops script content case-insensitively", () => {
    expect(htmlToText("<p>a</p><SCRIPT>x()</ScRiPt><p>b</p>")).toBe("a\nb");
  });
});

describe("isHtmlEmpty", () => {
  it.each([
    "",
    "   ",
    "<p></p>",
    "<p> </p>",
    "<p><br></p>",
    "<strong></strong>",
    "<p>&nbsp;</p>",
    "&nbsp;  ",
    "<p>​</p>",
    "<hr>",
    '<img src="">',
    "<audio controls></audio>",
    "<script>alert(1)</script>",
  ])("treats %j as empty", html => {
    expect(isHtmlEmpty(html)).toBe(true);
  });

  it.each([
    "<p>x</p>",
    '<img src="/a.png">',
    "<audio src='/a.mp3' controls></audio>",
    '<p><img alt="" src=https://example.com/a.png></p>',
  ])("treats %j as content", html => {
    expect(isHtmlEmpty(html)).toBe(false);
  });

  it("reports media without inventing text for it", () => {
    expect(analyzeHtml('<p><img src="/a.png" alt="cat"></p>')).toEqual({
      hasMedia: true,
      text: "",
    });
  });
});
