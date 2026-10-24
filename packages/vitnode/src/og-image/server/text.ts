/**
 * Collapses whitespace and cuts `text` to at most `maxLength` characters,
 * ending at a word boundary with `…` when it had to cut. Counts user-perceived
 * characters, so an emoji or a combined letter is never split in half.
 *
 * Deterministic, so the same title always wraps the same way. Use it in a
 * template before handing text to the renderer.
 */
export const truncateOgText = (text: string, maxLength: number): string => {
  const normalized = text.replace(/\s+/g, " ").trim();
  const graphemes = [
    ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
      normalized,
    ),
  ].map(part => part.segment);
  if (graphemes.length <= maxLength) return normalized;
  if (maxLength <= 1) return "…";

  const cut = graphemes.slice(0, maxLength - 1).join("");
  const lastSpace = cut.lastIndexOf(" ");
  // Only back off to a space when it keeps most of the text; one long word
  // would otherwise shrink to nothing.
  const head =
    lastSpace > cut.length * 0.6 ? cut.slice(0, lastSpace) : cut.trimEnd();

  return `${head.replace(/[\s,.;:!?-]+$/u, "")}…`;
};

/**
 * A title font size that keeps long titles inside the card: large for a few
 * words, stepping down as the title grows. Pixels.
 */
export const ogTitleFontSize = (title: string): number => {
  const length = [...title].length;
  if (length <= 30) return 76;
  if (length <= 60) return 64;
  if (length <= 90) return 54;

  return 46;
};
