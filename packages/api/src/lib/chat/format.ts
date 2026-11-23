/**
 * The light formatting chat messages support: `**bold**`, `*italic*`,
 * `` `code` ``, fenced ```` ``` ```` blocks, `>!spoiler!<`, line breaks and
 * auto-linked `http(s)` URLs. Parsed into tokens - never HTML - so the
 * server (previews, emails, exports) and the browser read a message the
 * same way. Browser-safe.
 */
export type ChatInlineToken =
  | { children: ChatInlineToken[]; type: "bold" }
  | { children: ChatInlineToken[]; type: "italic" }
  | { children: ChatInlineToken[]; type: "spoiler" }
  | { href: string; text: string; type: "link" }
  | { text: string; type: "code" }
  | { text: string; type: "text" }
  | { type: "break" };

export type ChatBlockToken =
  | { children: ChatInlineToken[]; type: "paragraph" }
  | { text: string; type: "codeBlock" };

const URL_PATTERN = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]}]/gu;

interface Delimiter {
  close: string;
  open: string;
  type: "bold" | "italic" | "spoiler";
}

const DELIMITERS: readonly Delimiter[] = [
  { close: "**", open: "**", type: "bold" },
  { close: "!<", open: ">!", type: "spoiler" },
  { close: "*", open: "*", type: "italic" },
];

const linkify = (text: string): ChatInlineToken[] => {
  const tokens: ChatInlineToken[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index;
    if (index > last)
      tokens.push({ text: text.slice(last, index), type: "text" });
    tokens.push({ href: match[0], text: match[0], type: "link" });
    last = index + match[0].length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last), type: "text" });

  return tokens;
};

const plainWithBreaks = (text: string): ChatInlineToken[] =>
  text
    .split("\n")
    .flatMap((line, index) => [
      ...(index > 0 ? [{ type: "break" } as const] : []),
      ...linkify(line),
    ]);

const parseInline = (text: string, depth = 0): ChatInlineToken[] => {
  if (depth > 4) return plainWithBreaks(text);

  const tokens: ChatInlineToken[] = [];
  let buffer = "";
  let index = 0;
  const flush = () => {
    if (buffer) tokens.push(...plainWithBreaks(buffer));
    buffer = "";
  };

  while (index < text.length) {
    if (text[index] === "`") {
      const end = text.indexOf("`", index + 1);
      if (end > index + 1 && !text.slice(index + 1, end).includes("\n")) {
        flush();
        tokens.push({ text: text.slice(index + 1, end), type: "code" });
        index = end + 1;
        continue;
      }
    }

    const delimiter = DELIMITERS.find(item =>
      text.startsWith(item.open, index),
    );
    if (delimiter) {
      const start = index + delimiter.open.length;
      const end = text.indexOf(delimiter.close, start);
      const inner = end > start ? text.slice(start, end) : "";
      if (inner.trim() && inner.trim() === inner) {
        flush();
        tokens.push({
          children: parseInline(inner, depth + 1),
          type: delimiter.type,
        });
        index = end + delimiter.close.length;
        continue;
      }
    }

    buffer += text[index];
    index++;
  }
  flush();

  return tokens;
};

/** Parses a message body into blocks: fenced code and paragraphs. */
export const parseChatMessage = (body: string): ChatBlockToken[] => {
  const blocks: ChatBlockToken[] = [];
  const parts = body.split(/```/u);
  parts.forEach((part, index) => {
    const isCode = index % 2 === 1 && index < parts.length - 1;
    if (isCode) {
      blocks.push({
        text: part.replace(/^\n/u, "").replace(/\n$/u, ""),
        type: "codeBlock",
      });

      return;
    }
    const text = index % 2 === 1 ? `\`\`\`${part}` : part;
    const trimmed = text.replace(/^\n+|\n+$/gu, "");
    if (trimmed)
      blocks.push({ children: parseInline(trimmed), type: "paragraph" });
  });

  return blocks;
};

const inlineText = (tokens: ChatInlineToken[], spoilers: boolean): string =>
  tokens
    .map(token => {
      switch (token.type) {
        case "bold":
        case "italic":
          return inlineText(token.children, spoilers);
        case "break":
          return " ";
        case "spoiler":
          return spoilers ? inlineText(token.children, spoilers) : "▒▒▒";
        default:
          return token.text;
      }
    })
    .join("");

/**
 * The message as one line of plain text, with spoilers masked, cut to
 * `maxLength` characters with an ellipsis. For previews and notifications.
 */
export const chatMessagePlainText = (
  body: string,
  maxLength?: number,
): string => {
  const text = parseChatMessage(body)
    .map(block =>
      block.type === "codeBlock"
        ? block.text
        : inlineText(block.children, false),
    )
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
  if (maxLength === undefined || text.length <= maxLength) return text;

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};
