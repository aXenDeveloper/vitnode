import type {
  AnyBlockDefinition,
  AnyBlockVariantDefinition,
  BlockVariantDefinition,
} from "./types";

export type BlockVariantResolution =
  | { kind: "resolved"; variant: string | undefined }
  | { kind: "unknown"; variant: string };

export const blockVariants = (
  definition: AnyBlockDefinition,
): readonly AnyBlockVariantDefinition[] => definition.variants ?? [];

export const hasBlockVariants = (definition: AnyBlockDefinition): boolean =>
  blockVariants(definition).length > 0;

export const findBlockVariant = (
  definition: AnyBlockDefinition,
  variant: string,
): AnyBlockVariantDefinition | undefined =>
  blockVariants(definition).find(entry => entry.id === variant);

export const resolveBlockVariant = (
  definition: AnyBlockDefinition,
  variant: string | undefined,
): BlockVariantResolution => {
  if (variant === undefined) {
    return { kind: "resolved", variant: definition.defaultVariant };
  }

  return findBlockVariant(definition, variant) === undefined
    ? { kind: "unknown", variant }
    : { kind: "resolved", variant };
};

export const blockVariantLabel = (variant: BlockVariantDefinition): string =>
  variant.label ?? variant.id;
