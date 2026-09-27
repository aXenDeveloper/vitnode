import type { EditorCustomEmoji } from "@vitnode/core/components/editor-provider";

const customEmojiHtml = (emoji?: EditorCustomEmoji): string => {
  if (!emoji) {
    return `<p>Unicode &#127881; from a shortcode. Register an emoji under <code>editor.emojis</code> in your config and it shows up here too.</p>`;
  }

  return `<p>Unicode &#127881; from a shortcode, and <code>:${emoji.name}:</code>, a custom one this app registered in its config: <span data-type="emoji" data-name="${emoji.name}"><img src="${emoji.src}" draggable="false" loading="lazy" align="absmiddle" alt="${emoji.name} emoji"></span></p>`;
};

export const editorShowcaseHtml = (emoji?: EditorCustomEmoji): string => `
<h1 style="text-align: center">Editor showcase</h1>
<p style="text-align: center"><span style="color: #2563eb; font-size: 18px">Every extension the toolbar can reach, exactly as it is stored.</span></p>
<hr>
<h2>Text</h2>
<p><strong>Bold</strong>, <em>italic</em>, <u>underline</u>, <s>strike</s>, <code>inline code</code>, a <a href="https://vitnode.com" target="_blank" rel="noopener noreferrer nofollow">link</a>, and typography that rewrote (c) as &copy;, -&gt; as &rarr; and 1/2 as &frac12;.</p>
<p style="text-align: right">Right aligned.</p>
<p style="text-align: justify">Justified text stretches to both edges of the column, which only shows up once the line is long enough to wrap at least once in the reading width.</p>
<h3>Lists</h3>
<ul class="list-disc"><li><p>Bullet item</p></li><li><p>Another one</p></li></ul>
<ol class="list-decimal"><li><p>Ordered item</p></li><li><p>Second</p></li></ol>
<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Done task</p></li><li data-type="taskItem" data-checked="false"><p>Open task</p></li></ul>
<h3>Blockquote and code</h3>
<blockquote><p>A blockquote keeps its own border, spacing and muted colour.</p></blockquote>
<pre><code>&lt;EditorContent content={html} /&gt;</code></pre>
<h3>Panels</h3>
<div data-panel="info" class="tiptap-panel"><p>Panels have an optional title</p><p>The first paragraph becomes the title as soon as the panel has a second one.</p></div>
<div data-panel="warning" class="tiptap-panel"><p>Plugins need a workspace</p><p>Run the generator from a repository with <code>turbo.json</code>; a plain single-folder app has nowhere for <code>plugins/*</code>.</p></div>
<div data-panel="error" class="tiptap-panel"><p>An error panel flags a blocker or a real risk.</p></div>
<div data-panel="success" class="tiptap-panel"><p>A success panel calls out what went right.</p></div>
<h3>Table</h3>
<div class="tableWrapper"><table><tbody>
<tr><th colspan="1" rowspan="1"><p>Extension</p></th><th colspan="1" rowspan="1"><p>Shows up as</p></th></tr>
<tr><td colspan="1" rowspan="1"><p>Table</p></td><td colspan="1" rowspan="1"><p>This table, scrolling sideways when it gets too wide</p></td></tr>
<tr><td colspan="1" rowspan="1"><p>Audio</p></td><td colspan="1" rowspan="1"><p>The player below</p></td></tr>
</tbody></table></div>
<h3>Emoji</h3>
${customEmojiHtml(emoji)}
<h3>Audio</h3>
<audio class="tiptap-audio" controls preload="metadata" src="https://assets.tiptap.dev/sounds/loop.mp3"></audio>
`;
