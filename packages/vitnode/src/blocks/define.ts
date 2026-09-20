import type {
  AnyBlockVariantDefinition,
  BlockComponent,
  BlockData,
  BlockDefinition,
  BlockFieldMap,
  BlockVariantDefinition,
} from "./types";

import { assertBlockFields } from "./capabilities";
import { BLOCK_VARIANT_ID_MAX_LENGTH, BLOCK_VARIANT_PATTERN } from "./const";
import { BlockError } from "./errors";
import { assertBlockName } from "./namespace";

export interface DefineBlockArgs<
  TId extends string,
  TFields extends BlockFieldMap,
  TVariant extends string = string,
> {
  component: BlockComponent<BlockData<TFields>, TVariant>;
  defaultVariant?: NoInfer<TVariant>;
  description?: string;
  fields: TFields;
  id: TId;
  name?: string;
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

export const defineBlock = <
  const TFields extends BlockFieldMap,
  TId extends string = string,
  TVariant extends string = string,
>({
  component,
  defaultVariant,
  description,
  fields,
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
    id,
    name,
    variants,
  };
};
