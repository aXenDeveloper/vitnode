/**
 * The one HTML -> plain text extractor.
 *
 * Isomorphic on purpose - no DOM, no `sanitize-html` - so the browser (editor
 * emptiness, AdminCP previews), the API (validation, search, SEO) and the plugins
 * all read the same text out of the same HTML. It never decides what is safe to
 * render; `sanitizeEditorHtml` does that.
 *
 * A single linear scan rather than a chain of regular expressions: tags are
 * dropped where they stand, text is entity-decoded exactly once per text run (so
 * `&amp;lt;` reads `&lt;`, never `<`), and block boundaries become line breaks
 * so `<p>a</p><p>b</p>` reads `a` / `b` instead of `ab`.
 */

/** Content of these elements is never text a reader sees. */
const RAW_TEXT_ELEMENTS = new Set([
  "iframe",
  "noscript",
  "script",
  "style",
  "template",
  "textarea",
  "title",
]);

/** Elements that end a line. */
const BLOCK_ELEMENTS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "br",
  "caption",
  "dd",
  "details",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "summary",
  "table",
  "tbody",
  "tfoot",
  "thead",
  "tr",
  "ul",
]);

/** Elements whose neighbours on the same line are separated by a space. */
const CELL_ELEMENTS = new Set(["td", "th"]);

/**
 * Elements that are content without being text. An image or an audio clip with
 * a source is something a reader gets; an `<hr>` or an empty checkbox is not.
 */
const MEDIA_ELEMENTS = new Set(["audio", "img"]);

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  bull: "•",
  copy: "©",
  euro: "€",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  middot: "·",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  reg: "®",
  rsquo: "’",
  shy: "",
  trade: "™",
  zwj: "",
  zwnj: "",
};

const ENTITY_PATTERN =
  /&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z]{2,8}));/g;

const fromCodePoint = (codePoint: number, raw: string): string => {
  if (
    !Number.isFinite(codePoint) ||
    codePoint <= 0 ||
    codePoint > 0x10ffff ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
  ) {
    return raw;
  }

  return String.fromCodePoint(codePoint);
};

/** Decodes one run of text. Never called on its own output. */
const decodeEntities = (text: string): string =>
  text.includes("&")
    ? text.replace(
        ENTITY_PATTERN,
        (raw, decimal?: string, hex?: string, name?: string) => {
          if (decimal !== undefined) {
            return fromCodePoint(Number.parseInt(decimal, 10), raw);
          }
          if (hex !== undefined) {
            return fromCodePoint(Number.parseInt(hex, 16), raw);
          }

          return NAMED_ENTITIES[(name ?? "").toLowerCase()] ?? raw;
        },
      )
    : text;

// `\s` already covers the non-breaking and typographic spaces (and the BOM),
// so they read as a space. Soft hyphens and zero-width characters read as
// nothing at all - built from code points, since a literal would be invisible.
const SPACE_LIKE = /\s+/g;
const INVISIBLE = new RegExp(
  `[${[0xad, 0x200b, 0x200c, 0x200d, 0x2060].map(code => String.fromCodePoint(code)).join("")}]`,
  "g",
);

const LINE_BREAK = "\n";

const ATTRIBUTE_PATTERN =
  /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const hasNonEmptyAttribute = (attributes: string, wanted: string): boolean => {
  for (const match of attributes.matchAll(ATTRIBUTE_PATTERN)) {
    if (match[1].toLowerCase() !== wanted) continue;

    const value = match[2] ?? match[3] ?? match[4] ?? "";

    return value.trim() !== "";
  }

  return false;
};

/** Index of the `>` closing a tag that starts at `from`, honouring quotes. */
const tagEnd = (html: string, from: number): number => {
  let quote: null | string = null;

  for (let index = from; index < html.length; index++) {
    const char = html[index];

    if (quote !== null) {
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === ">") return index;
  }

  return -1;
};

const isAsciiLetter = (char: string | undefined): boolean =>
  char !== undefined && /[a-zA-Z]/.test(char);

export interface HtmlTextAnalysis {
  /** An `img` or `audio` element with a non-empty `src` is present. */
  hasMedia: boolean;
  /** Readable plain text: one line per block, trimmed, entities decoded once. */
  text: string;
}

/** Plain text and media presence of an HTML fragment, in one pass. */
export const analyzeHtml = (html: string): HtmlTextAnalysis => {
  const parts: string[] = [];
  let hasMedia = false;
  let preDepth = 0;
  let index = 0;

  const pushText = (raw: string): void => {
    if (raw === "") return;

    const decoded = decodeEntities(raw).replace(INVISIBLE, "");
    // Inside `<pre>` a source newline is a line break the reader sees; anywhere
    // else it is just whitespace, exactly as a browser renders it.
    parts.push(
      preDepth > 0
        ? decoded.replace(/\r\n?/g, LINE_BREAK)
        : decoded.replace(SPACE_LIKE, " "),
    );
  };

  while (index < html.length) {
    const open = html.indexOf("<", index);
    if (open === -1) {
      pushText(html.slice(index));
      break;
    }

    pushText(html.slice(index, open));

    const next = html[open + 1];

    // `<!-- comment -->`
    if (html.startsWith("<!--", open)) {
      const close = html.indexOf("-->", open + 4);
      index = close === -1 ? html.length : close + 3;
      continue;
    }

    // `<!DOCTYPE>`, `<?xml ?>`, `</ >` - markup, never text.
    if (
      next === "!" ||
      next === "?" ||
      (next === "/" && !isAsciiLetter(html[open + 2]))
    ) {
      const close = html.indexOf(">", open + 1);
      index = close === -1 ? html.length : close + 1;
      continue;
    }

    const closing = next === "/";
    const nameStart = closing ? open + 2 : open + 1;

    // A `<` that does not start a tag is literal text: `a < b`.
    if (!isAsciiLetter(html[nameStart])) {
      parts.push("<");
      index = open + 1;
      continue;
    }

    let nameEnd = nameStart;
    while (nameEnd < html.length && /[a-zA-Z0-9:-]/.test(html[nameEnd])) {
      nameEnd++;
    }
    const name = html.slice(nameStart, nameEnd).toLowerCase();

    const end = tagEnd(html, nameEnd);
    // An unterminated tag at the end of the input is dropped, as a parser would.
    if (end === -1) break;

    index = end + 1;

    if (!closing && RAW_TEXT_ELEMENTS.has(name)) {
      const closePattern = new RegExp(`</${name}`, "gi");
      closePattern.lastIndex = index;
      const closeTag = closePattern.exec(html)?.index ?? -1;
      if (closeTag === -1) break;
      const closeEnd = tagEnd(html, closeTag + 2 + name.length);
      index = closeEnd === -1 ? html.length : closeEnd + 1;
      continue;
    }

    if (
      !closing &&
      !hasMedia &&
      MEDIA_ELEMENTS.has(name) &&
      hasNonEmptyAttribute(html.slice(nameEnd, end), "src")
    ) {
      hasMedia = true;
    }

    if (name === "pre") preDepth = Math.max(0, preDepth + (closing ? -1 : 1));

    if (BLOCK_ELEMENTS.has(name)) {
      parts.push(LINE_BREAK);
    } else if (CELL_ELEMENTS.has(name)) {
      parts.push(" ");
    }
  }

  const text = parts
    .join("")
    .split(LINE_BREAK)
    .map(line => line.replace(SPACE_LIKE, " ").trim())
    .filter(line => line !== "")
    .join(LINE_BREAK);

  return { hasMedia, text };
};

/** Readable plain text, one line per paragraph, list item or table row. */
export const htmlToText = (html: string): string => analyzeHtml(html).text;

/** Plain text on a single line - for a search snippet, a meta description, a length check. */
export const stripHtml = (input: string): string =>
  htmlToText(input).replace(SPACE_LIKE, " ").trim();

/**
 * Whether rich text holds nothing a reader would get: no text and no media.
 *
 * `<p></p>`, `<p><br></p>`, `<strong> </strong>` and `&nbsp;` are all empty; a
 * lone `<img src>` or `<audio src>` is not.
 */
export const isHtmlEmpty = (html: string): boolean => {
  const { hasMedia, text } = analyzeHtml(html);

  return text === "" && !hasMedia;
};
