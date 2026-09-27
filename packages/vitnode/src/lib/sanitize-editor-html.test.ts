import { describe, expect, it } from "vitest";

import { sanitizeEditorHtml } from "./sanitize-editor-html";

const EDITOR_OUTPUT = `
<h1 style="text-align: center">Showcase</h1>
<p style="text-align: center"><span style="color: #2563eb; font-size: 18px">Coloured</span></p>
<hr>
<p><strong>Bold</strong>, <em>italic</em>, <u>underline</u>, <s>strike</s>, <code>code</code>, <a href="https://vitnode.com" target="_blank" rel="noopener noreferrer nofollow">link</a></p>
<ul class="list-disc"><li><p>Bullet</p></li></ul>
<ol class="list-decimal"><li><p>Ordered</p></li></ol>
<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked" disabled=""><span></span></label><div><p>Done</p></div></li></ul>
<blockquote><p>Quote</p></blockquote>
<pre><code>&lt;EditorContent /&gt;</code></pre>
<div data-panel="warning" class="tiptap-panel"><p>Panel</p></div>
<div class="tableWrapper"><table><tbody><tr><th colspan="1" rowspan="1"><p>Head</p></th></tr><tr><td colspan="1" rowspan="1"><p>Cell</p></td></tr></tbody></table></div>
<p><span data-type="emoji" data-name="vitnode"><img src="/logo_vitnode_icon.svg" draggable="false" loading="lazy" align="absmiddle" alt="vitnode emoji"></span></p>
<audio class="tiptap-audio" controls preload="metadata" src="https://assets.tiptap.dev/sounds/loop.mp3"></audio>
`;

const signature = (html: string): string[] => {
  const template = document.createElement("template");
  template.innerHTML = html;

  return [...template.content.querySelectorAll("*")].map(element => {
    const attributes = [...element.attributes]
      .map(({ name, value }) =>
        name === "style" ? `${name}=${value.replaceAll(/\s/g, "")}` : name,
      )
      .toSorted();

    return `${element.tagName.toLowerCase()}[${attributes.join(",")}]`;
  });
};

describe("sanitizeEditorHtml", () => {
  it("keeps every tag and attribute the editor stores", () => {
    expect(signature(sanitizeEditorHtml(EDITOR_OUTPUT))).toEqual(
      signature(EDITOR_OUTPUT),
    );
  });

  it.each([
    ["a script", "<p>Hi</p><script>alert(1)</script>", "<script"],
    ["an event handler", '<img src="/x.png" onerror="alert(1)">', "onerror"],
    [
      "a javascript: link",
      '<a href="javascript:alert(1)">x</a>',
      "javascript:",
    ],
    ["an iframe", '<iframe src="https://evil.example"></iframe>', "<iframe"],
    ["a style tag", "<style>body{display:none}</style>", "<style"],
    ["an SVG payload", '<svg onload="alert(1)"></svg>', "<svg"],
    [
      "a CSS url()",
      '<p style="background:url(https://evil.example)">x</p>',
      "evil.example",
    ],
  ])("removes %s", (_, html, forbidden) => {
    expect(sanitizeEditorHtml(html)).not.toContain(forbidden);
  });

  it("drops classes the editor never writes, so content cannot restyle the page", () => {
    expect(
      sanitizeEditorHtml('<div class="tiptap-panel fixed inset-0">x</div>'),
    ).toBe('<div class="tiptap-panel">x</div>');
  });

  it("keeps a task checkbox read-only and drops any other input", () => {
    expect(sanitizeEditorHtml('<input type="checkbox" checked>')).toBe(
      '<input type="checkbox" checked disabled />',
    );
    expect(sanitizeEditorHtml('<input type="text" value="x">')).toBe("");
  });

  it("stops a new-tab link from reaching back into the page", () => {
    expect(
      sanitizeEditorHtml('<a href="https://vitnode.com" target="_blank">x</a>'),
    ).toBe(
      '<a href="https://vitnode.com" target="_blank" rel="noopener noreferrer nofollow">x</a>',
    );
  });
});
