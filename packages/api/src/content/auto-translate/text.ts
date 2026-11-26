const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/giu;
const MENTION_PATTERN = /(?<![\p{L}\p{N}_])@[\p{L}\p{N}_.-]+/gu;
const EMOJI_PATTERN =
  /[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}]|\u{200D}|\u{FE0F}|\u{20E3}|:[a-z0-9_+-]+:/gu;
const LETTER_PATTERN = /\p{L}/gu;
const WORD_PATTERN = /\p{L}[\p{L}\p{M}'’-]*/gu;

const ACKNOWLEDGMENTS: ReadonlySet<string> = new Set([
  "agreed",
  "bravo",
  "brb",
  "cool",
  "danke",
  "dzieki",
  "dzięki",
  "dziekuje",
  "dziękuję",
  "fine",
  "gg",
  "gracias",
  "great",
  "idk",
  "imo",
  "k",
  "kk",
  "lmao",
  "lol",
  "merci",
  "nice",
  "nie",
  "no",
  "nope",
  "ok",
  "okay",
  "okej",
  "okey",
  "ok thanks",
  "ok thx",
  "omg",
  "rofl",
  "same",
  "spoko",
  "super",
  "tak",
  "thanks",
  "thank you",
  "thx",
  "ty",
  "wow",
  "yeah",
  "yep",
  "yes",
]);

const LAUGHTER_PATTERN = /^(?:(?:ha|he|hi|ja|xd)+|lo+l|x+d+)$/u;

/** Why a text is not sent for translation. */
export type AutoTranslateSkipReason =
  | "acknowledgment"
  | "no_text"
  | "single_word"
  | "uncertain_language";

export type AutoTranslateTextClass =
  | { kind: "hard_skip"; reason: "acknowledgment" | "no_text" }
  | { kind: "soft_skip"; reason: "single_word"; words: number }
  | { kind: "translatable"; words: number };

/** Lowercased, without formatting, emoji and surrounding punctuation or symbols. */
export const normalizeAcknowledgment = (text: string): string =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(EMOJI_PATTERN, " ")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

/** The text without URLs, mentions and emoji: what a reader would need translated. */
export const stripUntranslatable = (text: string): string =>
  text
    .replace(URL_PATTERN, " ")
    .replace(MENTION_PATTERN, " ")
    .replace(EMOJI_PATTERN, " ");

/**
 * Sorts plain text without any AI: `hard_skip` (empty, emoji-only, a bare
 * link or mention, or a whole acknowledgment such as "OK!", "lol" or "+1")
 * never translates; `soft_skip` (a single word) is skipped automatically but
 * may be translated on request; anything else may be translated.
 *
 * Browser-safe, so a page can hide its Translate action for text the server
 * would refuse anyway.
 */
export const classifyTranslatableText = (
  text: string,
): AutoTranslateTextClass => {
  const meaningful = stripUntranslatable(text);
  const letters = meaningful.match(LETTER_PATTERN)?.length ?? 0;
  if (letters === 0) return { kind: "hard_skip", reason: "no_text" };

  const normalized = normalizeAcknowledgment(meaningful);
  if (
    ACKNOWLEDGMENTS.has(normalized) ||
    LAUGHTER_PATTERN.test(normalized.replaceAll(" ", ""))
  ) {
    return { kind: "hard_skip", reason: "acknowledgment" };
  }

  const words = meaningful.match(WORD_PATTERN)?.length ?? 0;
  if (words <= 1) return { kind: "soft_skip", reason: "single_word", words };

  return { kind: "translatable", words };
};

/** The words of a text, lowercased, for language heuristics. */
export const textWords = (text: string): string[] =>
  (stripUntranslatable(text).toLowerCase().match(WORD_PATTERN) ?? []).map(
    word => word.replace(/['’-]+$/u, ""),
  );

const PROTECTED_PATTERN = new RegExp(
  `${URL_PATTERN.source}|${MENTION_PATTERN.source}|\`[^\`\\n]+\``,
  "giu",
);

/**
 * Swaps URLs, mentions and inline `code` for numbered placeholders, so a
 * model cannot change them. {@link restoreProtectedTokens} puts them back.
 */
export const protectTokens = (
  text: string,
): { text: string; tokens: string[] } => {
  const tokens: string[] = [];
  const protectedText = text.replace(PROTECTED_PATTERN, match => {
    tokens.push(match);

    return `⟦${tokens.length}⟧`;
  });

  return { text: protectedText, tokens };
};

/**
 * Restores {@link protectTokens} placeholders. Returns `null` when the
 * translation lost, repeated or invented one.
 */
export const restoreProtectedTokens = (
  text: string,
  tokens: readonly string[],
): null | string => {
  const seen = new Set<number>();
  let valid = true;
  const restored = text.replace(/⟦(\d+)⟧/gu, (_match, raw: string) => {
    const index = Number(raw);
    if (index < 1 || index > tokens.length || seen.has(index)) {
      valid = false;

      return "";
    }
    seen.add(index);

    return tokens[index - 1];
  });

  return valid && seen.size === tokens.length ? restored : null;
};
