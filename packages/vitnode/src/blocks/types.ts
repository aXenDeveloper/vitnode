import type { ComponentType, ReactElement } from "react";

import type { ContentFieldMap, ContentValuesOf } from "../content/types";
import type {
  AREA_ALIGNS,
  AREA_COLUMNS,
  AREA_JUSTIFIES,
  AREA_LEGACY_SPACINGS,
  CONTENT_AREA_KIND,
} from "./const";

export type BlockFieldMap = Record<string, { kind: string }>;

export type BlockData<TFields> = ContentValuesOf<TFields>;

export type BlockUnknownData = Record<string, unknown>;

export interface BlockVariantDefinition<TId extends string = string> {
  description?: string;
  id: TId;
  label?: string;
}

export type AnyBlockVariantDefinition = BlockVariantDefinition;

export interface BlockComponentProps<
  TData = BlockUnknownData,
  TVariant extends string = string,
> {
  blockId: string;
  data: TData;
  index: number;
  type: string;
  variant?: TVariant;
}

export type BlockComponent<
  TData = BlockUnknownData,
  TVariant extends string = string,
> = ComponentType<BlockComponentProps<TData, TVariant>>;

export type BlockIcon = ComponentType<{ className?: string }>;

export interface BlockDefinition<
  TId extends string = string,
  TFields extends BlockFieldMap = ContentFieldMap,
  TVariant extends string = string,
> {
  component: BlockComponent;
  defaultVariant?: TVariant;
  description?: string;
  fields: TFields;
  icon?: BlockIcon;
  id: TId;
  name?: string;
  variants?: readonly BlockVariantDefinition<TVariant>[];
}

export type AnyBlockDefinition = BlockDefinition;

export interface BlockInstance<
  TType extends string = string,
  TData = BlockUnknownData,
  TVariant extends string = string,
> {
  data: TData;
  id: string;
  type: TType;
  variant?: TVariant;
}

export type AnyBlockInstance = BlockInstance;

export type BlockAreaColumns = (typeof AREA_COLUMNS)[number];

export type BlockAreaAlign = (typeof AREA_ALIGNS)[number];

export type BlockAreaJustify = (typeof AREA_JUSTIFIES)[number];

export type AreaLegacySpacing = (typeof AREA_LEGACY_SPACINGS)[number];

export interface BlockAreaLayout {
  align?: BlockAreaAlign;
  columns: BlockAreaColumns;
  /** Pixels between the area's own children. */
  gap?: number;
  justify?: BlockAreaJustify;
  /** Pixels to the inline start and end of the area, outside its own grid. */
  marginX?: number;
  /** Pixels above and below the area, outside its own grid. */
  marginY?: number;
}

export type AreaStoredSpacing = AreaLegacySpacing | number;

export interface BlockAreaStoredLayout extends Omit<
  BlockAreaLayout,
  "gap" | "marginX" | "marginY"
> {
  gap?: AreaStoredSpacing;
  marginX?: AreaStoredSpacing;
  marginY?: AreaStoredSpacing;
}

export interface BlockAreaInstance {
  children: readonly AnyBlockInstance[];
  id: string;
  kind: typeof CONTENT_AREA_KIND;
  layout: BlockAreaStoredLayout;
}

export type ContentNode = AnyBlockInstance | BlockAreaInstance;

export type BlockAllowedEntry = string;

export type BlockAllowedSpec = "*" | readonly BlockAllowedEntry[];

export interface BlockPluginSource {
  blocks?: readonly AnyBlockDefinition[];
  namespace?: string;
  pluginId: string;
}

export interface RegisteredBlock {
  definition: AnyBlockDefinition;
  namespace: string;
  pluginId: string;
  type: string;
}

export interface BlockRegistry {
  all: () => readonly RegisteredBlock[];
  byNamespace: (namespace: string) => readonly RegisteredBlock[];
  get: (type: string) => RegisteredBlock | undefined;
  has: (type: string) => boolean;
  namespaces: () => readonly string[];
}

export type BlockRenderFallbackReason =
  "invalid-data" | "not-allowed" | "unknown-type" | "unknown-variant";

export interface BlockRenderFallbackProps {
  instance: AnyBlockInstance;
  reason: BlockRenderFallbackReason;
}

export type BlockValidationMode = "always" | "development" | "never";

export type BlockRenderFallback = (
  props: BlockRenderFallbackProps,
) => null | ReactElement;

export interface ContentZoneDefinition {
  allowedBlocks?: BlockAllowedSpec;
  id: string;
}

export interface ParsedContentZoneId {
  name: string;
  scope: string | undefined;
}
