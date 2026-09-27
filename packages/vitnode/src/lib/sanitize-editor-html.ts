import sanitizeHtml from "sanitize-html";

const EDITOR_CLASSES = [
  "list-disc",
  "list-decimal",
  "tableWrapper",
  "tiptap-audio",
  "tiptap-panel",
];

const CSS_LENGTH = /^\d+(?:\.\d+)?(?:px|em|rem|%)$/;
const CSS_COLOR = /^(?:#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i;

const EDITOR_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedAttributes: {
    "*": [
      "class",
      "data-checked",
      "data-name",
      "data-panel",
      "data-type",
      "style",
    ],
    a: ["href", "rel", "target"],
    audio: ["controls", "preload", "src"],
    col: ["span", "width"],
    img: ["align", "alt", "draggable", "height", "loading", "src", "width"],
    input: ["checked", "disabled", "type"],
    td: ["colspan", "colwidth", "rowspan"],
    th: ["colspan", "colwidth", "rowspan"],
  },
  allowedClasses: { "*": EDITOR_CLASSES },
  allowedSchemes: ["http", "https", "mailto"],
  allowedStyles: {
    "*": {
      color: [CSS_COLOR],
      "font-size": [CSS_LENGTH],
      "text-align": [/^(?:left|right|center|justify)$/],
    },
  },
  allowedTags: [
    "a",
    "audio",
    "blockquote",
    "br",
    "code",
    "col",
    "colgroup",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "img",
    "input",
    "label",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "span",
    "strong",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
  ],
  exclusiveFilter: frame =>
    frame.tag === "input" && frame.attribs.type !== "checkbox",
  transformTags: {
    a: (tagName, attribs) => ({
      attribs:
        attribs.target === "_blank"
          ? { ...attribs, rel: "noopener noreferrer nofollow" }
          : attribs,
      tagName,
    }),
    input: (tagName, attribs) => ({
      attribs: { ...attribs, disabled: "" },
      tagName,
    }),
  },
};

export const sanitizeEditorHtml = (html: string): string =>
  sanitizeHtml(html, EDITOR_HTML_OPTIONS);
