import type { ContentFieldMap } from "../types";

import { CONTENT_SLUG_DEFAULT_LENGTH } from "../const";
import { ContentInputError } from "../errors";
import { slugify } from "../slug";

interface SlugFieldConfig {
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

/**
 * The slug rules, in one place.
 *
 * Shared by the plain service and the editorial one rather than duplicated: a
 * restore writes through the same normalisation an update does, and two copies
 * of "never re-derive on update" is exactly the pair that drifts.
 */
export const createSlugNormalizer = (
  contentTypeId: string,
  fields: ContentFieldMap,
): ContentSlugNormalizer => {
  const slugFields = slugFieldsOf(fields);

  /**
   * Normalises a slug and refuses one that folds to nothing.
   *
   * Nothing random or numeric is appended - `slugify` is deterministic, and
   * uniqueness belongs to the unique index, which surfaces a clash as a 409.
   */
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
