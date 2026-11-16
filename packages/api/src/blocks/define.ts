import type {
  AnyBlockVariantDefinition,
  BlockFieldMap,
  BlockSchemaDefinition,
  BlockVariantDefinition,
} from "./types";

import { assertBlockFields } from "./capabilities";
import { BLOCK_VARIANT_ID_MAX_LENGTH, BLOCK_VARIANT_PATTERN } from "./const";
import { BlockError } from "./errors";
import { assertBlockName } from "./namespace";

/** What {@link defineBlockSchema} (exported as `defineWidgetSchema`) takes. */
export interface DefineBlockSchemaArgs<
  TId extends string,
  TFields extends BlockFieldMap,
  TVariant extends string = string,
> {
  /** Variant used when an instance stores none. Must be one of `variants`. */
  defaultVariant?: NoInfer<TVariant>;
  /** Shown in the Visual Editor's catalogue. */
  description?: string;
  /**
   * Content Engine fields (`field.text()`, `field.enum()`, ...) the data is
   * validated and edited with. Only boolean, dateTime, enum, group, number,
   * text and textarea fields are accepted, at least one, and fields are never
   * localized.
   */
  fields: TFields;
  /**
   * Name without a namespace, e.g. `"callout"`. The registry prefixes the
   * plugin's namespace, so it is stored as `example:callout`.
   */
  id: TId;
  /** Display name in the editor. */
  name?: string;
  /**
   * Alternative looks for the same data. The chosen id is stored beside the
   * instance's data, and the editor shows a picker for it.
   */
  variants?: readonly BlockVariantDefinition<TVariant>[];
}

const variantIds = (variants: readonly AnyBlockVariantDefinition[]): string =>
  variants.map(variant => `"${variant.id}"`).join(", ");

const assertBlockVariants = (
  blockId: string,
  variants: readonly AnyBlockVariantDefinition[] | undefined,
  defaultVariant: string | undefined,
): void => {
  if (variants === undefined) {
    if (defaultVariant === undefined) return;

    throw new BlockError(
      `\`defaultVariant: "${defaultVariant}"\` is set on a block that declares no \`variants\`. A default has to name one of them, so declare the variants or drop the default.`,
      { blockId },
    );
  }

  if (variants.length === 0) {
    throw new BlockError(
      "`variants: []` declares a list of nothing. A block either offers variants or it does not - leave `variants` off entirely rather than shipping an empty picker.",
      { blockId },
    );
  }

  const seen = new Set<string>();

  for (const variant of variants) {
    if (
      !BLOCK_VARIANT_PATTERN.test(variant.id) ||
      variant.id.length > BLOCK_VARIANT_ID_MAX_LENGTH
    ) {
      throw new BlockError(
        `Variant id "${variant.id}" must be lowercase letters, digits and single hyphens, at most ${BLOCK_VARIANT_ID_MAX_LENGTH} characters. It is written into every stored instance that picks it, so it has to survive the round trip unchanged.`,
        { blockId },
      );
    }

    if (seen.has(variant.id)) {
      throw new BlockError(
        `Variant id "${variant.id}" is declared twice. A stored instance names its variant by id alone, so two variants sharing one could never be told apart.`,
        { blockId },
      );
    }

    seen.add(variant.id);
  }

  if (defaultVariant !== undefined && !seen.has(defaultVariant)) {
    throw new BlockError(
      `\`defaultVariant: "${defaultVariant}"\` names a variant this block does not declare. It declares ${variantIds(variants)}.`,
      { blockId },
    );
  }
};

/**
 * Declares a widget's schema: its id, Content Engine fields and variants -
 * the part the API validates instance data against, fills defaults from and
 * stores. No React is involved, so it is safe in an API-only process.
 *
 * Register the schemas on the API with `buildApiPlugin({ blocks })`. In the
 * browser, `defineWidget` from `@vitnode/core/widgets` takes the same schema
 * plus a component, and both register under the same qualified id.
 *
 * Universal.
 *
 * @throws {BlockError} For an invalid or namespaced `id`, an unsupported
 * field kind, invalid or duplicate variant ids, an empty `variants`, or a
 * `defaultVariant` that is not declared.
 *
 * @example
 * ```ts
 * import { field } from "@vitnode/api/content";
 * import { defineWidgetSchema } from "@vitnode/api/blocks";
 *
 * export const calloutSchema = defineWidgetSchema({
 *   id: "callout",
 *   name: "Callout",
 *   fields: { title: field.text({ required: true, maxLength: 120 }) },
 * });
 * ```
 */
export const defineBlockSchema = <
  const TFields extends BlockFieldMap,
  TId extends string = string,
  TVariant extends string = string,
>({
  defaultVariant,
  description,
  fields,
  id,
  name,
  variants,
}: DefineBlockSchemaArgs<TId, TFields, TVariant>): BlockSchemaDefinition<
  TId,
  TFields,
  TVariant
> => {
  assertBlockName(id);
  assertBlockVariants(id, variants, defaultVariant);

  return {
    defaultVariant,
    description,
    fields: assertBlockFields(id, fields),
    id,
    name,
    variants,
  };
};
