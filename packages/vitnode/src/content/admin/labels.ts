import type { AnyContentTypeDefinition } from "../types";

export type ContentLabelSubject = Pick<AnyContentTypeDefinition, "id">;

/**
 * Turns `publishedAt` into "Published at" - the fallback whenever a plugin has
 * not translated a field name.
 */
export const humanizeFieldName = (name: string): string => {
  // Sentence case, not title case: "Published at" reads better as a form label
  // than "Published At".
  const spaced = name
    .replace(
      /([a-z0-9])([A-Z])/g,
      (_match, before: string, upper: string) =>
        `${before} ${upper.toLowerCase()}`,
    )
    .replace(/[_-]+/g, " ")
    .trim();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** `example.article` -> `article`; `example.kb.article` -> `kb_article`. */
export const contentEntityKey = (contentTypeId: string): string =>
  contentTypeId.split(".").slice(1).join("_");

/**
 * A readable name for the record, derived from its id: `blog.post` -> "Post".
 *
 * For the places a translation cannot reach - an OpenAPI description, an API
 * error message, and the AdminCP before anything is translated. Derived rather
 * than declared, because a name written in the definition is one language's
 * answer to a question every install answers in its own: the noun a person
 * reads comes from `{pluginId}.content.{entity}.label`, and this is what stands
 * in until it does.
 */
export const contentTypeName = (contentTypeId: string): string =>
  humanizeFieldName(contentEntityKey(contentTypeId));

/**
 * The i18n keys the generated AdminCP looks up, all under the owning plugin's
 * namespace. Every one is optional - `t.has(key)` decides, and the definition's
 * own labels are the fallback.
 */
export const contentI18nKeys = (
  definition: ContentLabelSubject,
  pluginId: string,
) => {
  const base = `${pluginId}.content.${contentEntityKey(definition.id)}`;

  return {
    desc: `${base}.desc`,
    enumValue: (field: string, value: string) =>
      `${base}.enums.${field}.${value}`,
    field: (field: string) => `${base}.fields.${field}`,
    /**
     * The record's own noun, as a **cardinal plural** message:
     * `"{count, plural, one {Article} other {Articles}}"`.
     *
     * One key rather than a `singular`/`plural` pair, because a pair is only
     * enough for languages that have exactly two forms. Polish needs `one`,
     * `few` and `many` for the same noun, and ICU is what knows which one a
     * count selects in the reader's locale - a decision that cannot be made
     * where the content type is defined, in English, once.
     */
    label: `${base}.label`,
    /** One generated form section's heading and its optional lead-in. */
    section: (name: string) => ({
      desc: `${base}.form.${name}.desc`,
      title: `${base}.form.${name}.title`,
    }),
    title: `${base}.title`,
  };
};

/**
 * The translator shape these lookups need, from either half of next-intl.
 *
 * `getTranslations` and `useTranslations` type their keys as a union of every
 * message in the catalogue, which a key assembled at runtime cannot satisfy. One
 * structural type, cast once where a translator enters, beats the same cast
 * repeated at every key. `has` is what keeps it honest - nothing below reads a
 * message without asking whether it exists.
 */
export interface ContentLabelTranslator {
  (key: string, values?: Record<string, number | string>): string;
  has: (key: string) => boolean;
}

/**
 * A content type's noun, and the heading of its screen, in the reader's language.
 *
 * The **one** place this fallback chain lives, because it is read from three
 * screens that have to agree: the sidebar item, the list heading and every dialog
 * that says "Create {name}".
 *
 * Where it stops is the name derived from the id, identical in every number and
 * every language - which is the honest shape of an untranslated content type. A
 * definition holds no display name to fall back to on purpose: two of them, one
 * in code and one in messages, is one too many, and the one in code is the one
 * that cannot be translated.
 */
export const contentNouns = (
  definition: ContentLabelSubject,
  pluginId: string,
  t: ContentLabelTranslator,
): { plural: string; singular: string; title: string } => {
  const keys = contentI18nKeys(definition, pluginId);
  const fallback = contentTypeName(definition.id);
  /**
   * `count` selects the form through ICU rather than picking a field, so a locale
   * with three plural forms answers correctly where a `singular`/`plural` pair
   * could only ever hold two. `2` is what asks for the bare plural: `other` in
   * English and `few` in Polish, the forms those languages name a list of things
   * with ("Articles", "Artykuły") - where `5` would select Polish's genitive
   * `many` and read as a quantity nobody asked about.
   */
  const noun = (count: number): string =>
    t.has(keys.label) ? t(keys.label, { count }) : fallback;
  const plural = noun(2);

  return {
    plural,
    singular: noun(1),
    // A screen's heading may legitimately differ from the noun ("Blog articles"
    // over a list of "Articles"), so an explicit `title` wins - and without one
    // the heading is the plural noun rather than a second thing to translate.
    title: t.has(keys.title) ? t(keys.title) : plural,
  };
};
