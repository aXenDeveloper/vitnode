import { randomInt } from "node:crypto";

import type { ContentFieldMap } from "../types";

import {
  CONTENT_GENERATED_SLUG_LENGTH,
  CONTENT_SLUG_DEFAULT_LENGTH,
} from "../const";
import { ContentInputError } from "../errors";
import { slugify } from "../slug";

const GENERATED_SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** A random, URL-safe, lowercase token - the slug of a record with no title. */
export const generateContentSlug = (
  maxLength: number = CONTENT_SLUG_DEFAULT_LENGTH,
): string =>
  Array.from(
    { length: Math.min(CONTENT_GENERATED_SLUG_LENGTH, maxLength) },
    () => GENERATED_SLUG_ALPHABET[randomInt(GENERATED_SLUG_ALPHABET.length)],
  ).join("");

interface SlugFieldConfig {
  /** Minted on create when the payload omits it. */
  generated: boolean;
  maxLength: number;
  name: string;
  /** Field the value is derived from when a create payload omits the slug. */
  source: string | undefined;
}

const slugFieldsOf = (fields: ContentFieldMap): SlugFieldConfig[] => {
  const slugFields: SlugFieldConfig[] = [];

  for (const [name, fieldValue] of Object.entries(fields)) {
    if (fieldValue.kind !== "slug") continue;

    slugFields.push({
      generated: fieldValue.generated,
      maxLength: fieldValue.maxLength ?? CONTENT_SLUG_DEFAULT_LENGTH,
      name,
      source: fieldValue.source,
    });
  }

  return slugFields;
};

export interface ContentSlugNormalizer {
  /** Fills in and normalises every slug on the way into a create. */
  withCreateSlugs: (values: Record<string, unknown>) => Record<string, unknown>;
  /** Normalises the slugs a patch actually names, and only those. */
  withUpdateSlugs: (patch: Record<string, unknown>) => Record<string, unknown>;
}

export const createSlugNormalizer = (
  contentTypeId: string,
  fields: ContentFieldMap,
): ContentSlugNormalizer => {
  const slugFields = slugFieldsOf(fields);

  const toSlug = (
    slugField: SlugFieldConfig,
    value: string,
    derived: boolean,
  ): string => {
    const slug = slugify(value, slugField.maxLength);
    if (slug !== "") return slug;

    throw new ContentInputError(
      derived
        ? `Could not derive "${slugField.name}" from "${slugField.source}". Send "${slugField.name}" explicitly.`
        : `Field "${slugField.name}" normalises to an empty slug. Use at least one letter or digit.`,
      { contentTypeId },
    );
  };

  return {
    withCreateSlugs: values => {
      if (slugFields.length === 0) return values;

      const next = { ...values };

      for (const slugField of slugFields) {
        const supplied = next[slugField.name];

        // A supplied value is normalised rather than trusted, so the same rules
        // apply whether the slug came from the caller or from the source field.
        if (typeof supplied === "string") {
          next[slugField.name] = toSlug(slugField, supplied, false);
          continue;
        }

        if (slugField.generated) {
          next[slugField.name] = generateContentSlug(slugField.maxLength);
          continue;
        }

        // `assertSlugSources` guarantees a source exists whenever the create
        // schema lets the value be omitted, so this is the derived branch.
        const source = slugField.source ?? "";
        const from = next[source];

        next[slugField.name] = toSlug(
          slugField,
          typeof from === "string" ? from : "",
          true,
        );
      }

      return next;
    },

    withUpdateSlugs: patch => {
      if (slugFields.length === 0) return patch;

      const next = { ...patch };

      // A slug is never re-derived here: editing the title of a published
      // article must not silently move its URL and 404 every link to it.
      // Sending the slug is the only way to change it.
      for (const slugField of slugFields) {
        const supplied = next[slugField.name];
        if (typeof supplied !== "string") continue;

        next[slugField.name] = toSlug(slugField, supplied, false);
      }

      return next;
    },
  };
};
