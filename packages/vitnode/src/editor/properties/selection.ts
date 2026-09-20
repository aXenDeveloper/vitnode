import type {
  AnyBlockDefinition,
  AnyBlockInstance,
  AnyBlockVariantDefinition,
  BlockAreaInstance,
} from "../../blocks/types";
import type { EditorNodeRef, VisualEditorState } from "../state/types";

import { isBlockAreaInstance } from "../../blocks/area";
import { blockVariants, resolveBlockVariant } from "../../blocks/variant";
import { findNode } from "../state/reducer";

export type EditorSelectionView =
  | null
  | { area: BlockAreaInstance; index: number; kind: "area" }
  | { index: number; instance: AnyBlockInstance; kind: "block" };

export interface VariantControlSpec {
  clearable: boolean;
  options: readonly AnyBlockVariantDefinition[];
  unknown: null | string;
  value: string | undefined;
  visible: boolean;
}

export const VARIANT_CLEAR_VALUE = "vitnode:default-variant";

export const selectedNode = (
  state: VisualEditorState,
  ref: EditorNodeRef | null,
): EditorSelectionView => {
  const found = ref === null ? null : findNode(state, ref);
  if (!found) return null;

  return isBlockAreaInstance(found.node)
    ? { area: found.node, index: found.index, kind: "area" }
    : { index: found.index, instance: found.node, kind: "block" };
};

export const variantControlSpec = (
  definition: AnyBlockDefinition,
  variant: string | undefined,
): VariantControlSpec => {
  const options = blockVariants(definition);
  const resolution = resolveBlockVariant(definition, variant);
  const unknown = resolution.kind === "unknown" ? resolution.variant : null;
  const clearable =
    unknown !== null || (options.length > 1 && variant !== undefined);

  return {
    clearable,
    options,
    unknown,
    value: resolution.kind === "resolved" ? resolution.variant : undefined,
    visible: clearable || options.length > 1,
  };
};

export const variantFromControlValue = (value: string): string | undefined =>
  value === VARIANT_CLEAR_VALUE ? undefined : value;
