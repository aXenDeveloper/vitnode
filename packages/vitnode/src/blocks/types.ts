import type {
  AnyBlockInstance,
  BlockPluginSource as ApiBlockPluginSource,
  BlockRegistry as ApiBlockRegistry,
  RegisteredBlock as ApiRegisteredBlock,
  BlockFieldMap,
  BlockSchemaDefinition,
  BlockUnknownData,
} from "@vitnode/api/blocks/types";
import type { ContentFieldMap } from "@vitnode/api/content/types";
import type { ComponentType, ReactElement } from "react";

export type {
  AnyBlockInstance,
  AnyBlockSchemaDefinition,
  AnyBlockVariantDefinition,
  AreaLegacySpacing,
  AreaStoredSpacing,
  BlockAllowedEntry,
  BlockAllowedSpec,
  BlockAreaAlign,
  BlockAreaColumns,
  BlockAreaInstance,
  BlockAreaJustify,
  BlockAreaLayout,
  BlockAreaStoredLayout,
  BlockData,
  BlockFieldMap,
  BlockInstance,
  BlockSchemaDefinition,
  BlockUnknownData,
  BlockVariantDefinition,
  ContentNode,
  ContentZoneDefinition,
  ParsedContentZoneId,
} from "@vitnode/api/blocks/types";

/** Props of a widget's component. */
export interface BlockComponentProps<
  TData = BlockUnknownData,
  TVariant extends string = string,
> {
  /** The instance's own stable id, not the widget's type. */
  blockId: string;
  /** The stored data: validated when saved, shape-checked before render. Defaults are applied at write time only. */
  data: TData;
  /** Position among its siblings. */
  index: number;
  /** The qualified widget id, e.g. `"example:callout"`. */
  type: string;
  /** The look this instance picked, resolved against the declared variants; `undefined` for a widget with none. */
  variant?: TVariant;
}

export type BlockComponent<
  TData = BlockUnknownData,
  TVariant extends string = string,
> = ComponentType<BlockComponentProps<TData, TVariant>>;

export type BlockIcon = ComponentType<{ className?: string }>;

/**
 * A widget as the browser registers it: the schema the API validates against
 * (`BlockSchemaDefinition` from `@vitnode/api/blocks`) plus how it renders.
 */
export interface BlockDefinition<
  TId extends string = string,
  TFields extends BlockFieldMap = ContentFieldMap,
  TVariant extends string = string,
> extends BlockSchemaDefinition<TId, TFields, TVariant> {
  /** Renders one instance. */
  component: BlockComponent;
  /** Icon component for the editor; a generic widget icon when missing. */
  icon?: BlockIcon;
}

export type AnyBlockDefinition = BlockDefinition;

/**
 * A plugin's widgets as the browser registers them, collected into the app's
 * generated `src/blocks.gen.ts`. The API registers the same ids from schemas
 * (`buildApiPlugin({ blocks })`), so both sides namespace them identically.
 */
export type BlockPluginSource<
  TDefinition extends AnyBlockDefinition = AnyBlockDefinition,
> = ApiBlockPluginSource<TDefinition>;

export type RegisteredBlock<
  TDefinition extends AnyBlockDefinition = AnyBlockDefinition,
> = ApiRegisteredBlock<TDefinition>;

/** Every installed widget by qualified id, with its component. Built by `createWidgetRegistry`. */
export type BlockRegistry<
  TDefinition extends AnyBlockDefinition = AnyBlockDefinition,
> = ApiBlockRegistry<TDefinition>;

export type BlockRenderFallbackReason =
  | "invalid-data"
  | "not-allowed"
  | "unknown-type"
  | "unknown-variant";

export interface BlockRenderFallbackProps {
  instance: AnyBlockInstance;
  reason: BlockRenderFallbackReason;
}

/**
 * Whether rendering enforces a zone's allowlist and logs warnings. A data
 * shape check and skipping unknown types or variants always apply; full
 * validation happens on write.
 */
export type BlockValidationMode = "always" | "development" | "never";

export type BlockRenderFallback = (
  props: BlockRenderFallbackProps,
) => null | ReactElement;
