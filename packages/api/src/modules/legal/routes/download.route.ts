import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/builders";
import { escapeRichTextHtml, richTextToHtml } from "@/content/rich-text/html";
import {
  legalRequestLocale,
  loadLegalVersionDocument,
} from "@/lib/legal/public.server";

import { zodLocaleQuery, zodVersionParam } from "../legal.schema";

export const downloadLegalRoute = buildRoute({
  route: {
    method: "get",
    description:
      "A self-contained HTML copy of one announced version, to keep or print: title, version, dates, change summary, full text and content hash.",
    path: "/{documentType}/versions/{version}/download",
    request: { params: zodVersionParam, query: zodLocaleQuery },
    responses: {
      200: {
        content: { "text/html": { schema: z.string() } },
        description: "HTML file",
      },
      404: { description: "No such version" },
    },
  },
  handler: async c => {
    const { documentType, version } = c.req.valid("param");
    const document = await loadLegalVersionDocument(
      c,
      documentType,
      version,
      legalRequestLocale(c, c.req.valid("query").locale),
    );
    if (!document) throw new HTTPException(404);

    const title = escapeRichTextHtml(document.title);
    const summary = document.summary
      .split(/\n+/)
      .filter(line => line.trim() !== "")
      .map(line => `<p>${escapeRichTextHtml(line)}</p>`)
      .join("");
    const html = `<!doctype html>
<html lang="${escapeRichTextHtml(document.locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - v${document.version}</title>
<style>body{font-family:system-ui,sans-serif;line-height:1.6;max-width:48rem;margin:2rem auto;padding:0 1rem;color:#111;background:#fff}dl{display:grid;grid-template-columns:auto 1fr;gap:.25rem 1rem}dt{font-weight:600}code{word-break:break-all}</style>
</head>
<body>
<h1>${title}</h1>
<dl>
<dt>Version</dt><dd>${document.version}</dd>
<dt>Announced</dt><dd><time datetime="${document.announcedAt}">${document.announcedAt}</time></dd>
<dt>Effective</dt><dd><time datetime="${document.effectiveAt}">${document.effectiveAt}</time></dd>
<dt>Language</dt><dd>${escapeRichTextHtml(document.locale)}</dd>
<dt>SHA-256</dt><dd><code>${document.contentHash}</code></dd>
</dl>
${summary ? `<section><h2>Summary</h2>${summary}</section>` : ""}
<hr>
<main>${richTextToHtml(document.body)}</main>
</body>
</html>`;

    c.header("Content-Type", "text/html; charset=utf-8");
    c.header(
      "Content-Disposition",
      `attachment; filename="${documentType}-v${document.version}-${document.locale}.html"`,
    );
    c.header("X-Content-Type-Options", "nosniff");
    c.header(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'",
    );

    return c.body(html, 200);
  },
});
