const TAG_PATTERN = /<\s*(\/?)\s*([a-zA-Z][\w:-]*)([^>]*?)(\/?)\s*>/g;
const ATTRIBUTE_PATTERN =
  /([^\s"'=<>`/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const TRANSLATABLE_ATTRIBUTES = new Set([
  "alt",
  "aria-label",
  "placeholder",
  "title",
]);

const normalizeAttributes = (raw: string): string =>
  [...raw.matchAll(ATTRIBUTE_PATTERN)]
    .map(match => {
      const name = match[1].toLowerCase();
      const value = match[2] ?? match[3] ?? match[4] ?? "";

      return { name, value };
    })
    .filter(({ name }) => !TRANSLATABLE_ATTRIBUTES.has(name))
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .map(({ name, value }) => `${name}=${JSON.stringify(value)}`)
    .join(" ");

export const htmlSkeleton = (html: string): string[] =>
  [...html.replace(/<!--[\s\S]*?-->/g, "").matchAll(TAG_PATTERN)].map(match => {
    const closing = match[1] === "/";
    const name = match[2].toLowerCase();
    if (closing) return `</${name}>`;
    const attributes = normalizeAttributes(match[3]);

    return attributes ? `<${name} ${attributes}>` : `<${name}>`;
  });

export const htmlStructureDifference = (
  source: string,
  translated: string,
): null | string => {
  const a = htmlSkeleton(source);
  const b = htmlSkeleton(translated);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) {
    if (a[index] !== b[index]) {
      return `expected ${a[index] ?? "nothing"} but got ${b[index] ?? "nothing"} at tag ${index + 1}`;
    }
  }

  return null;
};

export class HtmlStructureError extends Error {
  constructor(difference: string) {
    super(`The translated HTML changed the document structure: ${difference}.`);
    this.name = "HtmlStructureError";
  }
}

/**
 * Checks that a translated HTML string keeps the source's structure: the same
 * tags in the same order, with the same attributes. Text and the `alt`,
 * `aria-label`, `placeholder` and `title` attributes may differ; comments are
 * ignored. Call it from an AI action's `parseText` so a translation that
 * breaks markup or links fails the run.
 *
 * @throws {HtmlStructureError} With the first difference, when the structure
 * changed.
 */
export const assertSameHtmlStructure = (
  source: string,
  translated: string,
): void => {
  const difference = htmlStructureDifference(source, translated);
  if (difference) throw new HtmlStructureError(difference);
};
