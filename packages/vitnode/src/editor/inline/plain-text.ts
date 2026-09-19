import type { InlineFieldKind } from "./state";

const PLAIN_TEXT = "text/plain";

const NO_BREAK_SPACE = /\u00a0/gu;
const LINE_BREAK = /\r\n?|\n/gu;
const WHITESPACE_RUN = /\s+/gu;
const TRAILING_LINE_BREAK = /\n$/u;

export interface InlineTextSource {
  innerText?: string;
  textContent: null | string;
}

export interface InlinePlainTextClipboard {
  getData: (format: string) => string;
}

export const elementText = (source: InlineTextSource): string =>
  typeof source.innerText === "string"
    ? source.innerText
    : (source.textContent ?? "");

export const normalizeInlineText = (
  kind: InlineFieldKind,
  text: string,
): string => {
  const spaced = text.replace(NO_BREAK_SPACE, " ");

  return kind === "text"
    ? spaced.replace(LINE_BREAK, " ")
    : spaced.replace(LINE_BREAK, "\n").replace(TRAILING_LINE_BREAK, "");
};

export const normalizeInlinePaste = (
  kind: InlineFieldKind,
  text: string,
): string =>
  kind === "text"
    ? text.replace(NO_BREAK_SPACE, " ").replace(WHITESPACE_RUN, " ").trim()
    : normalizeInlineText(kind, text);

export const domInlineText = (
  kind: InlineFieldKind,
  source: InlineTextSource,
): string => normalizeInlineText(kind, elementText(source));

export const clipboardPlainText = (
  kind: InlineFieldKind,
  clipboard: InlinePlainTextClipboard | null | undefined,
): string =>
  clipboard === null || clipboard === undefined
    ? ""
    : normalizeInlinePaste(kind, clipboard.getData(PLAIN_TEXT));
