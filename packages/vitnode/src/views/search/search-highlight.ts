import React from "react";

export interface SearchHighlightPart {
  match: boolean;
  start: number;
  text: string;
}

const MIN_HIGHLIGHT_WORD_LENGTH = 2;

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const searchHighlightWords = (term: string | undefined): string[] => {
  if (!term) return [];

  const words = term
    .replaceAll('"', " ")
    .split(/\s+/)
    .filter(word => word !== "OR" && !word.startsWith("-"))
    .map(word => word.toLocaleLowerCase())
    .filter(word => word.length >= MIN_HIGHLIGHT_WORD_LENGTH);

  return [...new Set(words)].sort((a, b) => b.length - a.length);
};

export const searchHighlightPattern = (
  words: readonly string[],
): null | RegExp =>
  words.length > 0
    ? new RegExp(
        `(?<![\\p{L}\\p{N}])(?:${words.map(escapeRegExp).join("|")})`,
        "giu",
      )
    : null;

export const splitSearchHighlight = (
  text: string,
  pattern: RegExp,
): SearchHighlightPart[] => {
  const parts: SearchHighlightPart[] = [];
  let last = 0;

  for (const found of text.matchAll(pattern)) {
    if (found.index > last) {
      parts.push({
        match: false,
        start: last,
        text: text.slice(last, found.index),
      });
    }
    parts.push({ match: true, start: found.index, text: found[0] });
    last = found.index + found[0].length;
  }
  if (last < text.length) {
    parts.push({ match: false, start: last, text: text.slice(last) });
  }

  return parts;
};

export const searchSnippetAround = (
  content: string,
  pattern: null | RegExp,
  length: number,
): string => {
  if (content.length <= length) return content;

  const first = pattern ? content.search(pattern) : -1;
  if (first < length * 0.6) return `${content.slice(0, length).trimEnd()}…`;

  const lead = Math.max(0, first - Math.floor(length / 3));
  const start = content.lastIndexOf(" ", lead) + 1;
  const end = start + length;
  const body = content.slice(start, end).trim();

  return `${start > 0 ? "…" : ""}${body}${end < content.length ? "…" : ""}`;
};

export const SearchHighlightContext = React.createContext<null | RegExp>(null);

export const useSearchHighlight = (): null | RegExp =>
  React.use(SearchHighlightContext);
