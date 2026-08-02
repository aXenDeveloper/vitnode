import type { AnyContentTypeDefinition } from "../types";

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
 * The i18n keys the generated AdminCP looks up, all under the owning plugin's
 * namespace. Every one is optional - `t.has(key)` decides, and the definition's
 * own labels are the fallback.
 */
export const contentI18nKeys = (
  definition: AnyContentTypeDefinition,
  pluginId: string,
) => {
  const base = `${pluginId}.content.${contentEntityKey(definition.id)}`;

  return {
    desc: `${base}.desc`,
    enumValue: (field: string, value: string) =>
      `${base}.enums.${field}.${value}`,
    field: (field: string) => `${base}.fields.${field}`,
    title: `${base}.title`,
  };
};
