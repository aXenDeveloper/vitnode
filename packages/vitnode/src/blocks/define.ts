import type {
  AnyBlockVariantDefinition,
  BlockComponent,
  BlockData,
  BlockDefinition,
  BlockFieldMap,
  BlockIcon,
  BlockVariantDefinition,
} from "./types";

import { assertBlockFields } from "./capabilities";
import { BLOCK_VARIANT_ID_MAX_LENGTH, BLOCK_VARIANT_PATTERN } from "./const";
import { BlockError } from "./errors";
import { assertBlockName } from "./namespace";

/** What {@link defineBlock} (exported as `defineWidget`) takes. */
export interface DefineBlockArgs<
  TId extends string,
  TFields extends BlockFieldMap,
  TVariant extends string = string,
> {
  /** Renders one instance; `data` has already been parsed against `fields`. */
  component: BlockComponent<BlockData<TFields>, TVariant>;
  /** Variant used when an instance stores none. Must be one of `variants`. */
  defaultVariant?: NoInfer<TVariant>;
  /** Shown in the Visual Editor's catalogue. */
  description?: string;
  /**
   * Content Engine fields (`field.text()`, `field.enum()`, ...) the data is
   * validated and edited with. File, relation, user, repeatable, slug and
   * nested blocks fields are refused, and fields are never localized.
   */
  fields: TFields;
  /** Icon component (not an element) for the editor; defaults to a generic widget icon. */
  icon?: BlockIcon;
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
 * Declares a widget: an id, Content Engine fields and one React component. The
 * data type is inferred from `fields` (`WidgetData<typeof fields>`).
 *
 * Universal and validation-free at render time - the data schema is derived
 * on demand by `parseWidgetData` / `widgetDataSchema`. List the definition in
 * the plugin's widgets source and pass that to `buildApiPlugin({ blocks })`.
 *
 * @throws {BlockError} For an invalid or namespaced `id`, an unsupported
 * field kind, invalid or duplicate variant ids, an empty `variants`, or a
 * `defaultVariant` that is not declared.
 *
 * @example
 * ```tsx
 * import { field } from "@vitnode/core/content";
 * import { defineWidget, type WidgetComponentProps, type WidgetData } from "@vitnode/core/widgets";
 *
 * const calloutFields = {
 *   title: field.text({ required: true, maxLength: 120 }),
 * };
 *
 * const Callout = ({ data }: WidgetComponentProps<WidgetData<typeof calloutFields>>) => (
 *   <aside>{data.title}</aside>
 * );
 *
 * export const calloutWidget = defineWidget({
 *   id: "callout",
 *   name: "Callout",
 *   fields: calloutFields,
 *   component: Callout,
 * });
 * ```
 */
export const defineBlock = <
  const TFields extends BlockFieldMap,
  TId extends string = string,
  TVariant extends string = string,
>({
  component,
  defaultVariant,
  description,
  fields,
  icon,
  id,
  name,
  variants,
}: DefineBlockArgs<TId, TFields, TVariant>): BlockDefinition<
  TId,
  TFields,
  TVariant
> => {
  assertBlockName(id);
  assertBlockVariants(id, variants, defaultVariant);

  return {
    component: component as BlockComponent,
    defaultVariant,
    description,
    fields: assertBlockFields(id, fields),
    icon,
    id,
    name,
    variants,
  };
};
